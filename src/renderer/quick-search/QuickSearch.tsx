import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatClock } from '@shared/format/time'
import { serializeFilter, takeCompletedFilters, type QueryFilter } from '@shared/query/filters'
import { parseQuery } from '@shared/query/parseQuery'
import type { CaptureStatus, DeskItem, QuickIdle, SearchHit, SearchResponse } from '@shared/types'
import { useNow } from '../shared/useNow'
import { FilterBar } from './FilterBar'
import {
  TYPE_SHORTCUT_ORDER,
  buildQuery,
  canQuickLook,
  commandEnterAction,
  enterAction,
  footerHints,
  mergeChips,
  optionId,
  removeSpan,
  type KeyAction
} from './model'
import { Footer, IdleView, NoResults, PausedStrip } from './Parts'
import { Preview } from './Preview'
import { ResultList } from './Results'
import { SearchInput } from './SearchInput'
import styles from './QuickSearch.module.css'

const RESULTS_SIZE = { width: 860, height: 588 }
const COMPACT_WIDTH = 760
const DEBOUNCE_MS = 60
/** After this long hidden, the next open starts fresh (DESIGN §6.1). */
const RESET_AFTER_MS = 60_000
/**
 * Chromium on macOS sends Enter twice when it ends a Hangul composition: once with isComposing,
 * then again as a plain Enter right after compositionend. The second one only commits the syllable.
 */
const COMPOSITION_ECHO_MS = 100

/** DESIGN §6.1: 120 ms fade + scale on open only; nothing when the user prefers reduced motion. */
function animateOpen(el: HTMLElement | null): void {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  el.animate(
    [
      { opacity: 0, transform: 'scale(0.98)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    { duration: 120, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
  )
}

type Mode = 'idle' | 'results' | 'none'

export function QuickSearch(): React.JSX.Element {
  const now = useNow()
  const [text, setText] = useState('')
  const [chips, setChips] = useState<QueryFilter[]>([])
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [idle, setIdle] = useState<QuickIdle | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<CaptureStatus | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const composedAt = useRef(0)
  const requestSeq = useRef(0)

  const query = buildQuery(chips, text)
  const localDate = useMemo(() => parseQuery(text, new Date(now)).dateRange, [text, now])

  const reset = useCallback(() => {
    setText('')
    setChips([])
    setResponse(null)
    setSelectedId(null)
  }, [])

  // ── Main-process events ─────────────────────────────────────────────
  useEffect(() => {
    void window.desk.capture.status().then(setStatus)
    const offStatus = window.desk.on('capture-status', setStatus)
    const offItems = window.desk.on('items-changed', () => setRefreshTick((t) => t + 1))
    let resetTimer: ReturnType<typeof setTimeout> | undefined
    const offHidden = window.desk.on('quick-hidden', () => {
      resetTimer = setTimeout(reset, RESET_AFTER_MS)
    })
    const offShown = window.desk.on('quick-shown', ({ restore }) => {
      clearTimeout(resetTimer)
      if (!restore) reset()
      animateOpen(rootRef.current)
      setRefreshTick((t) => t + 1)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        if (restore) inputRef.current?.select()
      })
    })
    inputRef.current?.focus()
    return () => {
      offStatus()
      offItems()
      offHidden()
      offShown()
      clearTimeout(resetTimer)
    }
  }, [reset])

  // ── Search (debounced; only the latest response is kept) ────────────
  useEffect(() => {
    const seq = ++requestSeq.current
    if (!query) {
      setResponse(null)
      void window.desk.quickIdle().then((res) => {
        if (seq === requestSeq.current) setIdle(res)
      })
      return
    }
    const timer = setTimeout(() => {
      void window.desk.search(query).then((res) => {
        if (seq === requestSeq.current) setResponse(res)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, refreshTick])

  const mode: Mode = !query ? 'idle' : response && response.total > 0 ? 'results' : response ? 'none' : 'idle'
  const hits: SearchHit[] = useMemo(() => response?.groups.flatMap((g) => g.hits) ?? [], [response])
  const list: DeskItem[] = query ? hits.map((h) => h.item) : (idle?.recent ?? [])
  const selected = list.find((i) => i.id === selectedId) ?? list[0] ?? null
  const selectedHit = hits.find((h) => h.item.id === selected?.id) ?? null

  const selectedIsFirst = selected !== null && selected === list[0]
  useEffect(() => {
    if (!selected) return
    // The first row scrolls to the very top so its group header shows too. The first results arrive
    // while the panel is still compact, and "nearest" would leave the list scrolled once it grows.
    const scroller = document.getElementById('quick-search-results')
    if (selectedIsFirst && scroller) scroller.scrollTop = 0
    else document.getElementById(optionId(selected.id))?.scrollIntoView({ block: 'nearest' })
  }, [selected, selectedIsFirst])

  // ── Window size: results are fixed, other states fit their content ──
  useLayoutEffect(() => {
    if (mode === 'results') {
      window.desk.ui.resizeQuickSearch(RESULTS_SIZE.width, RESULTS_SIZE.height)
      return
    }
    const el = rootRef.current
    if (!el) return
    const fit = (): void => window.desk.ui.resizeQuickSearch(COMPACT_WIDTH, el.scrollHeight)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mode])

  // ── Actions ─────────────────────────────────────────────────────────
  const showFlash = (message: string): void => {
    setFlash(message)
    setTimeout(() => setFlash(null), 1200)
  }

  const perform = async (item: DeskItem, ka: KeyAction): Promise<void> => {
    await window.desk.act(item.id, ka.action)
    if (ka.hide) window.desk.ui.hideQuickSearch()
  }

  /**
   * ↵ must act on results for what is typed *now* — after a Hangul syllable is committed the
   * debounced search may not have run yet. Search once more if the response is stale.
   */
  const freshSelection = async (): Promise<DeskItem | null> => {
    if (!query) return selected
    if (response?.query === query) return selected
    requestSeq.current++
    const fresh = await window.desk.search(query)
    setResponse(fresh)
    const freshList = fresh.groups.flatMap((g) => g.hits.map((h) => h.item))
    return freshList.find((i) => i.id === selectedId) ?? freshList[0] ?? null
  }

  const togglePin = async (item: DeskItem): Promise<void> => {
    await window.desk.setPinned(item.id, !item.pinned)
    showFlash(item.pinned ? 'Unpinned' : 'Pinned to Desk')
  }

  const setTypeChip = (type: string | null): void =>
    setChips((c) => (type ? mergeChips(c, [{ key: 'type', value: type }]) : c.filter((x) => x.key !== 'type')))
  const setAppChip = (app: string | null): void =>
    setChips((c) => (app ? mergeChips(c, [{ key: 'app', value: app }]) : c.filter((x) => x.key !== 'app')))
  const searchAllTime = (): void => {
    if (localDate) setText(removeSpan(text, localDate.start, localDate.end))
  }

  // ── Input ───────────────────────────────────────────────────────────
  const applyText = (value: string): void => {
    const { filters, rest } = takeCompletedFilters(value)
    if (filters.length > 0) {
      setChips((c) => mergeChips(c, filters))
      setText(rest)
    } else {
      setText(value)
    }
    setSelectedId(null)
  }

  const onChange = (value: string): void => {
    // While a Hangul syllable is being composed, take the text as is; chips wait for compositionend.
    if (composing.current) setText(value)
    else applyText(value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Keys pressed during IME composition belong to the IME (DESIGN §6.3).
    if (e.nativeEvent.isComposing || composing.current || e.keyCode === 229) return
    if ((e.key === 'Enter' || e.key === 'Escape') && performance.now() - composedAt.current < COMPOSITION_ECHO_MS) {
      e.preventDefault()
      return
    }
    const input = e.currentTarget
    const index = selected ? list.findIndex((i) => i.id === selected.id) : -1

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = list[Math.min(list.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) setSelectedId(next.id)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.metaKey && mode === 'none') return searchAllTime()
      void freshSelection().then((item) => {
        if (item) void perform(item, e.metaKey ? commandEnterAction(item.type) : enterAction(item.type))
      })
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (text || chips.length > 0) reset()
      else window.desk.ui.hideQuickSearch()
      return
    }
    if (e.key === 'Backspace' && !text && chips.length > 0 && input.selectionStart === 0) {
      // The last chip goes back into the field as text so it can be edited (DESIGN §6.3).
      e.preventDefault()
      const last = chips[chips.length - 1] as QueryFilter
      setChips(chips.slice(0, -1))
      setText(serializeFilter(last))
      return
    }
    if (!e.metaKey || e.shiftKey || e.altKey) return
    const key = e.key.toLowerCase()
    const shortcutType = TYPE_SHORTCUT_ORDER[Number(key) - 1]
    if (shortcutType) {
      e.preventDefault()
      setTypeChip(chips.some((c) => c.key === 'type' && c.value === shortcutType) ? null : shortcutType)
    } else if (key === 'y' && selected && canQuickLook(selected.type)) {
      e.preventDefault()
      void window.desk.act(selected.id, 'quickLook')
    } else if (key === 'c' && selected && input.selectionStart === input.selectionEnd) {
      e.preventDefault() // nothing selected in the field: copy the item instead
      void perform(selected, { action: 'copy', hide: false }).then(() => showFlash('Copied'))
    } else if (key === 'p' && selected) {
      e.preventDefault()
      void togglePin(selected)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  const session = response?.groups.find((g) => g.kind === 'session')
  const topId = response?.groups[0]?.hits[0]?.item.id
  const sessionLabel =
    session && selected && (selected.id === topId || session.hits.some((h) => h.item.id === selected.id))
      ? (() => {
          const times = [
            ...session.hits.map((h) => h.item.capturedAt),
            response?.groups[0]?.hits[0]?.item.capturedAt ?? 0
          ]
          return `${session.hits.length + 1} items · ${formatClock(Math.min(...times))} – ${formatClock(Math.max(...times))}`
        })()
      : null

  const openItem = (item: DeskItem): void => void perform(item, enterAction(item.type))

  return (
    <div
      ref={rootRef}
      className={mode === 'results' ? styles.panelFull : styles.panel}
      role="dialog"
      aria-label="Quick Search"
    >
      <SearchInput
        inputRef={inputRef}
        text={text}
        chips={chips}
        date={localDate}
        count={mode === 'results' && response ? response.total : null}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={(value) => {
          composing.current = false
          composedAt.current = performance.now()
          applyText(value)
        }}
        onRemoveChip={(chip) => setChips((c) => c.filter((x) => x.key !== chip.key))}
      />
      {status?.paused && <PausedStrip status={status} />}

      {mode === 'results' && response && (
        <>
          <FilterBar
            response={response}
            dateLabel={response.dateRange?.label ?? null}
            onRemoveDate={searchAllTime}
            activeType={response.filters.type}
            onType={setTypeChip}
            activeApp={response.filters.app}
            onApp={setAppChip}
          />
          <div className={styles.body}>
            <ResultList
              groups={response.groups}
              words={response.matchWords}
              selectedId={selected?.id ?? null}
              now={now}
              onSelect={setSelectedId}
              onOpen={openItem}
            />
            {selectedHit && (
              <Preview
                hit={selectedHit}
                words={response.matchWords}
                session={sessionLabel}
                now={now}
                onButton={(spec) => void perform(selectedHit.item, spec)}
                onTogglePin={() => void togglePin(selectedHit.item)}
              />
            )}
          </div>
        </>
      )}

      {mode === 'none' && response && (
        <NoResults
          periodLabel={response.dateRange?.label ?? null}
          terms={response.terms}
          hasChips={chips.length > 0}
          onAllTime={searchAllTime}
          onClearFilters={() => setChips([])}
        />
      )}

      {mode === 'idle' && idle && (
        <IdleView idle={idle} selectedId={selected?.id ?? null} now={now} onSelect={setSelectedId} onOpen={openItem} />
      )}

      <Footer
        status={status}
        hints={footerHints(selected?.type ?? null)}
        note={
          flash ? (
            <span className={styles.flash}>{flash}</span>
          ) : mode === 'idle' && !idle?.empty ? (
            <span>
              Try <span className={styles.syntax}>yesterday</span>, <span className={styles.syntax}>type:link</span>,{' '}
              <span className={styles.syntax}>app:Figma</span>
            </span>
          ) : undefined
        }
      />
    </div>
  )
}
