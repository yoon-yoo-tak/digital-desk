import { Fragment } from 'react'
import { displayTitle, rowMeta } from '@shared/format/item'
import { formatResultTime } from '@shared/format/time'
import type { DeskItem, SearchGroup } from '@shared/types'
import { Highlighted } from '../shared/Highlighted'
import { Icon } from '../shared/Icon'
import { ItemGlyph } from '../shared/ItemGlyph'
import { optionId } from './model'
import styles from './QuickSearch.module.css'

interface RowProps {
  item: DeskItem
  title?: string | null
  words: readonly string[]
  selected: boolean
  now: number
  onSelect: () => void
  onOpen: () => void
}

/** 48px result row (DESIGN §6.5, Foundations "Result row"). */
export function ResultRow({ item, title, words, selected, now, onSelect, onOpen }: RowProps): React.JSX.Element {
  return (
    <div
      id={optionId(item.id)}
      role="option"
      aria-selected={selected}
      className={selected ? styles.rowSelected : styles.row}
      onMouseDown={(e) => {
        e.preventDefault() // keep focus in the input
        onSelect()
      }}
      onDoubleClick={onOpen}
    >
      <ItemGlyph item={item} />
      <div className={styles.rowText}>
        <div className={`truncate ${item.metadata.mono ? styles.rowTitleMono : styles.rowTitle}`}>
          <Highlighted text={title ?? displayTitle(item)} words={words} />
        </div>
        <div className={`truncate ${styles.rowMeta}`}>{rowMeta(item)}</div>
      </div>
      <div className={styles.rowTime}>{formatResultTime(item.lastUsedAt, now)}</div>
    </div>
  )
}

interface ListProps {
  groups: SearchGroup[]
  words: readonly string[]
  selectedId: string | null
  now: number
  onSelect: (id: string) => void
  onOpen: (item: DeskItem) => void
}

export function ResultList({ groups, words, selectedId, now, onSelect, onOpen }: ListProps): React.JSX.Element {
  return (
    <div
      id="quick-search-results"
      role="listbox"
      aria-label="Results"
      className={styles.list}
    >
      {groups.map((group, index) => (
        <Fragment key={group.kind}>
          {group.kind === 'session' ? (
            <div className={index === 0 ? styles.sectionFirst : styles.section}>
              <Icon name="context" size={12} />
              <span className={styles.sectionLabel}>{group.label}</span>
              <span className={styles.sectionCount}>{group.hits.length} more</span>
            </div>
          ) : (
            <div className={index === 0 ? styles.sectionFirst : styles.section}>{group.label}</div>
          )}
          {group.hits.map((hit) => (
            <ResultRow
              key={hit.item.id}
              item={hit.item}
              title={hit.item.type === 'text' ? hit.excerpt : null}
              words={words}
              selected={hit.item.id === selectedId}
              now={now}
              onSelect={() => onSelect(hit.item.id)}
              onOpen={() => onOpen(hit.item)}
            />
          ))}
        </Fragment>
      ))}
    </div>
  )
}
