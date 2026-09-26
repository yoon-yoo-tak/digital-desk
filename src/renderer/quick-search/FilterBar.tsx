import { useState } from 'react'
import { TYPE_LABELS } from '@shared/query/filters'
import type { SearchResponse } from '@shared/types'
import { Icon } from '../shared/Icon'
import { TYPE_SHORTCUT_ORDER } from './model'
import styles from './QuickSearch.module.css'

interface Props {
  response: SearchResponse
  dateLabel: string | null
  onRemoveDate: () => void
  activeType: string | undefined
  onType: (type: string | null) => void
  activeApp: string | undefined
  onApp: (app: string | null) => void
}

/** Date chip · type chips with counts · Any app (DESIGN §6.4). */
export function FilterBar({ response, dateLabel, onRemoveDate, activeType, onType, activeApp, onApp }: Props): React.JSX.Element {
  const [appsOpen, setAppsOpen] = useState(false)
  const counts = response.typeCounts
  const all = Object.values(counts).reduce((a, b) => a + b, 0)
  const noFocus = (e: React.MouseEvent): void => e.preventDefault() // keep the caret in the input

  return (
    <div className={styles.filterBar}>
      {dateLabel && (
        <button className={styles.dateChip} onMouseDown={noFocus} onClick={onRemoveDate} title="Remove date">
          <Icon name="calendar" size={13} />
          {dateLabel}
          <Icon name="close" size={10} />
        </button>
      )}
      {dateLabel && <div className={styles.divider} />}
      <button
        className={activeType ? styles.typeChip : styles.typeChipActive}
        onMouseDown={noFocus}
        onClick={() => onType(null)}
      >
        All <span className={styles.typeCount}>{all}</span>
      </button>
      {TYPE_SHORTCUT_ORDER.filter((t) => counts[t] > 0).map((type) => (
        <button
          key={type}
          className={activeType === type ? styles.typeChipActive : styles.typeChip}
          onMouseDown={noFocus}
          onClick={() => onType(activeType === type ? null : type)}
          title={`⌘${TYPE_SHORTCUT_ORDER.indexOf(type) + 1}`}
        >
          {TYPE_LABELS[type]} <span className={styles.typeCount}>{counts[type]}</span>
        </button>
      ))}
      <div className={styles.spacer} />
      <div className={styles.appPicker}>
        <button
          className={activeApp ? styles.typeChipActive : styles.typeChip}
          onMouseDown={noFocus}
          onClick={() => setAppsOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={appsOpen}
        >
          {activeApp ?? 'Any app'} <Icon name="chevron-down" size={10} />
        </button>
        {appsOpen && (
          <div className={styles.appMenu} role="listbox" aria-label="Filter by app">
            {[null, ...response.apps.slice(0, 8)].map((app) => (
              <button
                key={app ?? 'any'}
                role="option"
                aria-selected={(app ?? undefined) === activeApp}
                className={styles.appMenuItem}
                onMouseDown={noFocus}
                onClick={() => {
                  setAppsOpen(false)
                  onApp(app)
                }}
              >
                {app ?? 'Any app'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
