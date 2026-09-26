import type { CaptureStatus, View } from '@shared/types'
import { Icon } from '../shared/Icon'
import { strings } from '../shared/strings'
import styles from './Toolbar.module.css'

const VIEWS: View[] = ['inbox', 'desk', 'archive']

interface Props {
  view: View
  onViewChange: (view: View) => void
  status: CaptureStatus | null
}

export function Toolbar({ view, onViewChange, status }: Props): React.JSX.Element {
  const paused = status?.paused ?? false

  const openCaptureMenu = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    window.desk.ui.showCaptureMenu(rect.left, rect.bottom + 4)
  }

  return (
    <header className={styles.toolbar}>
      <div className={styles.lights} />
      <div role="tablist" aria-label="Sections" className={styles.segments}>
        {VIEWS.map((v, i) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            title={`${strings.views[v]}  ⌘${i + 1}`}
            className={view === v ? styles.segmentActive : styles.segment}
            onClick={() => onViewChange(v)}
          >
            {strings.views[v]}
          </button>
        ))}
      </div>
      <div className={styles.spacer} />
      <button
        className={styles.pill}
        onClick={openCaptureMenu}
        title={status?.helper === 'fallback' ? strings.capture.fallback : undefined}
        aria-haspopup="menu"
      >
        {paused ? (
          <Icon name="pause" size={10} className={styles.pauseGlyph} />
        ) : (
          <span className={styles.dot} />
        )}
        {paused ? strings.capture.paused : strings.capture.capturing}
      </button>
      <button className={styles.search} onClick={() => window.desk.ui.openQuickSearch()} aria-label="Search  ⌘K">
        <Icon name="search" size={14} />
        <span className={styles.searchLabel}>{strings.search}</span>
        <span className={styles.kbd}>⌘K</span>
      </button>
    </header>
  )
}
