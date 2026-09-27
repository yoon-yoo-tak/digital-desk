import { displayTitle } from '@shared/format/item'
import { captureLabel, CAPTURE_STRINGS } from '@shared/format/capture'
import { formatClock } from '@shared/format/time'
import type { CaptureStatus, DeskItem, QuickIdle } from '@shared/types'
import { Icon } from '../shared/Icon'
import { ResultRow } from './Results'
import styles from './QuickSearch.module.css'

export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className={styles.kbd}>{children}</span>
}

/** Under the input while capture is paused (SearchStates · 4). */
export function PausedStrip({ status }: { status: CaptureStatus }): React.JSX.Element {
  const until = status.pausedUntil
  return (
    <div className={styles.pausedStrip}>
      <Icon name="pause" size={14} className={styles.pausedIcon} />
      <span className={styles.pausedText}>
        {typeof until === 'number' ? `Capture paused · resumes at ${formatClock(until)}` : 'Capture paused'}
      </span>
      <button
        className={styles.resumeButton}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void window.desk.capture.resume()}
      >
        Resume now
      </button>
    </div>
  )
}

interface FooterProps {
  status: CaptureStatus | null
  hints: [string, string][]
  note?: React.ReactNode
}

export function Footer({ status, hints, note }: FooterProps): React.JSX.Element {
  return (
    <div className={styles.footer}>
      {status?.paused ? (
        <div className={styles.footerStatus}>
          <Icon name="pause" size={9} /> Paused
        </div>
      ) : (
        <div className={styles.footerStatus} title={status?.helper === 'unavailable' ? CAPTURE_STRINGS.unavailableDetail : undefined}>
          <span className={styles.statusDot} /> {captureLabel(status)}
        </div>
      )}
      <div className={styles.spacer} />
      {note}
      {!note &&
        hints.map(([key, label]) => (
          <div key={key} className={styles.hint}>
            <Kbd>{key}</Kbd>
            {label}
          </div>
        ))}
    </div>
  )
}

interface IdleProps {
  idle: QuickIdle
  selectedId: string | null
  now: number
  onSelect: (id: string) => void
  onOpen: (item: DeskItem) => void
}

/** Nothing typed yet: pinned things and the latest captures (SearchStates · 1). */
export function IdleView({ idle, selectedId, now, onSelect, onOpen }: IdleProps): React.JSX.Element {
  if (idle.empty) {
    return (
      <div className={styles.message}>
        <div className={styles.messageTitle}>Nothing here yet.</div>
        <div>Copy something, take a screenshot, or download a file.</div>
      </div>
    )
  }
  return (
    <div className={styles.idleBody} id="quick-search-results" role="listbox" aria-label="Recent">
      {idle.pinned.length > 0 && (
        <>
          <div className={styles.sectionFirst}>On your desk</div>
          <div className={styles.pinnedRow}>
            {idle.pinned.map((item) => (
              <button
                key={item.id}
                className={styles.pinnedChip}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onOpen(item)}
              >
                <Icon name="pin" size={12} />
                <span className="truncate">{displayTitle(item)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className={idle.pinned.length > 0 ? styles.section : styles.sectionFirst}>Recent</div>
      {idle.recent.map((item) => (
        <ResultRow
          key={item.id}
          item={item}
          words={[]}
          selected={item.id === selectedId}
          now={now}
          onSelect={() => onSelect(item.id)}
          onOpen={() => onOpen(item)}
        />
      ))}
    </div>
  )
}

interface NoResultsProps {
  periodLabel: string | null
  terms: string[]
  hasChips: boolean
  onAllTime: () => void
  onClearFilters: () => void
}

/** Never a dead end: offer the one widening step (SearchStates · 3). */
export function NoResults({ periodLabel, terms, hasChips, onAllTime, onClearFilters }: NoResultsProps): React.JSX.Element {
  const what = terms.length > 0 ? `“${terms.join(' ')}”` : 'your filters'
  const period = periodLabel ? periodLabel.split(' · ')[0]?.toLowerCase() : null
  return (
    <div className={styles.message}>
      <div>{period ? `Nothing from ${period} matches ${what}.` : `Nothing matches ${what}.`}</div>
      {(period || hasChips) && (
        <div className={styles.messageButtons}>
          {period && (
            <button className={styles.secondaryButton} onMouseDown={(e) => e.preventDefault()} onClick={onAllTime}>
              Search all time <Kbd>⌘↵</Kbd>
            </button>
          )}
          {hasChips && (
            <button className={styles.secondaryButton} onMouseDown={(e) => e.preventDefault()} onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
