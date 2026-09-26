import { useLayoutEffect, useRef } from 'react'
import { TYPE_LABELS, type QueryFilter } from '@shared/query/filters'
import type { DateMatch } from '@shared/query/dateExpressions'
import type { ItemType } from '@shared/types'
import { Icon } from '../shared/Icon'
import styles from './QuickSearch.module.css'

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>
  text: string
  chips: QueryFilter[]
  /** Date words inside `text`, drawn in the accent color with a dotted underline (DESIGN §6.3). */
  date: DateMatch | null
  count: number | null
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onCompositionStart: () => void
  onCompositionEnd: (value: string) => void
  onRemoveChip: (chip: QueryFilter) => void
}

function chipLabel(chip: QueryFilter): string {
  return chip.key === 'type' ? TYPE_LABELS[chip.value as ItemType] : chip.value
}

export function SearchInput(props: Props): React.JSX.Element {
  const { inputRef, text, chips, date, count } = props
  const mirror = useRef<HTMLDivElement>(null)

  // The input's text is transparent; a mirror underneath draws it with the date words styled.
  const syncScroll = (): void => {
    if (mirror.current && inputRef.current) mirror.current.scrollLeft = inputRef.current.scrollLeft
  }
  useLayoutEffect(syncScroll)

  return (
    <div className={styles.inputRow}>
      <Icon name="search" size={22} className={styles.searchIcon} />
      {chips.map((chip) => (
        <button
          key={chip.key}
          className={styles.queryChip}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => props.onRemoveChip(chip)}
          title="Remove filter"
        >
          <span className={styles.queryChipKey}>{chip.key}</span>
          {chipLabel(chip)}
        </button>
      ))}
      <div className={styles.field}>
        <div ref={mirror} className={styles.mirror} aria-hidden="true">
          {date ? (
            <>
              {text.slice(0, date.start)}
              <span className={styles.dateWords}>{text.slice(date.start, date.end)}</span>
              {text.slice(date.end)}
            </>
          ) : (
            text
          )}
        </div>
        <label htmlFor="quick-search-input" className="visually-hidden">
          Search your desk
        </label>
        <input
          id="quick-search-input"
          ref={inputRef}
          className={styles.input}
          value={text}
          placeholder={chips.length > 0 ? '' : 'Search your desk…'}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-controls="quick-search-results"
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={props.onKeyDown}
          onKeyUp={syncScroll}
          onScroll={syncScroll}
          onSelect={syncScroll}
          onCompositionStart={props.onCompositionStart}
          onCompositionEnd={(e) => props.onCompositionEnd(e.currentTarget.value)}
        />
      </div>
      {count !== null && <div className={styles.count}>{count === 1 ? '1 result' : `${count} results`}</div>}
    </div>
  )
}
