import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { displayTitle, rowMeta } from '@shared/format/item'
import { formatClock, formatDayHeader, startOfLocalDay } from '@shared/format/time'
import type { DeskItem, View } from '@shared/types'
import { Icon } from '../shared/Icon'
import { ItemGlyph } from '../shared/ItemGlyph'
import { strings } from '../shared/strings'
import { useNow } from '../shared/useNow'
import styles from './Timeline.module.css'

interface Props {
  view: View
  items: DeskItem[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (item: DeskItem) => void
  onArchive: (item: DeskItem, archived: boolean) => void
}

const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

interface DayGroup {
  day: number
  items: DeskItem[]
}

/** Inbox groups by day; Archive by month (DESIGN §7.5). `day` is the group's start. */
function groupItems(items: DeskItem[], byMonth: boolean): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const d = new Date(item.lastUsedAt)
    const day = byMonth ? new Date(d.getFullYear(), d.getMonth(), 1).getTime() : startOfLocalDay(item.lastUsedAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

const rowId = (id: string): string => `row-${id}`

export function Timeline(props: Props): React.JSX.Element {
  const { view, items, loading, hasMore, onLoadMore, selectedId, onSelect, onDelete, onArchive } = props
  const now = useNow()
  const groups = useMemo(() => groupItems(items, view === 'archive'), [items, view])
  const scroller = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ firstId: string | undefined; height: number }>({ firstId: undefined, height: 0 })

  // New captures arrive at the top. If the user has scrolled down, keep what they're looking at still.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const firstId = items[0]?.id
    const prev = anchor.current
    if (prev.firstId && firstId !== prev.firstId && el.scrollTop > 0) {
      el.scrollTop += el.scrollHeight - prev.height
    }
    anchor.current = { firstId, height: el.scrollHeight }
  }, [items])

  useEffect(() => {
    list.current?.focus()
  }, [view])

  useEffect(() => {
    if (selectedId) document.getElementById(rowId(selectedId))?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    if (hasMore && !loading && el.scrollHeight - el.scrollTop - el.clientHeight < 400) onLoadMore()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const index = items.findIndex((i) => i.id === selectedId)
    const current = items[index]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = items[Math.min(items.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) onSelect(next.id)
      return
    }
    if (!current) return
    if (e.key === 'Enter') {
      e.preventDefault()
      void window.desk.act(current.id, 'open')
    } else if (e.key === ' ') {
      e.preventDefault()
      void window.desk.act(current.id, 'quickLook')
    } else if (e.metaKey && e.key === 'c') {
      e.preventDefault()
      void window.desk.act(current.id, 'copy')
    } else if (e.metaKey && e.key === 'Backspace') {
      e.preventDefault()
      onDelete(current)
    } else if (e.metaKey && e.key === 'e') {
      e.preventDefault()
      onArchive(current, !current.archived)
    } else if (e.metaKey && e.key === 'p') {
      e.preventDefault()
      void window.desk.setPinned(current.id, !current.pinned)
    }
  }

  if (!loading && items.length === 0) {
    const empty = strings.empty[view]
    return (
      <div className={styles.column}>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{empty.title}</div>
          <div>{empty.body}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.column} ref={scroller} onScroll={onScroll}>
      <div
        ref={list}
        role="listbox"
        aria-label={strings.views[view]}
        aria-activedescendant={selectedId ? rowId(selectedId) : undefined}
        tabIndex={0}
        className={styles.list}
        onKeyDown={onKeyDown}
      >
        {groups.map((group) => {
          const header =
            view === 'archive'
              ? { label: monthLabel.format(group.day), detail: String(new Date(group.day).getFullYear()) }
              : formatDayHeader(group.day, now)
          return (
            <section key={group.day} aria-label={`${header.label}, ${header.detail}`}>
              <div className={styles.day}>
                <span>{header.label}</span>
                <span className={styles.dayDetail}>{header.detail}</span>
              </div>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  id={rowId(item.id)}
                  role="option"
                  aria-selected={item.id === selectedId}
                  className={item.id === selectedId ? styles.rowSelected : styles.row}
                  onMouseDown={() => onSelect(item.id)}
                  onDoubleClick={() => void window.desk.act(item.id, 'open')}
                >
                  <span className={styles.time}>
                    {view === 'archive' ? shortDate.format(item.lastUsedAt) : formatClock(item.lastUsedAt)}
                  </span>
                  <ItemGlyph item={item} />
                  <span className={styles.text}>
                    <span className={`truncate ${item.metadata.mono ? styles.titleMono : styles.title}`}>
                      {displayTitle(item)}
                    </span>
                    <span className={`truncate ${styles.meta}`}>{rowMeta(item)}</span>
                  </span>
                  {item.pinned && (
                    <span className={styles.pinned} aria-label="Pinned">
                      <Icon name="pin" size={14} filled />
                    </span>
                  )}
                  {view === 'archive' && (
                    <button
                      className={styles.unarchive}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => onArchive(item, false)}
                    >
                      Unarchive
                    </button>
                  )}
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
