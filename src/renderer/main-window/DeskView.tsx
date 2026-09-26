// Desk (DESIGN §7.4): what the user pinned. Context piles arrive with P1; pinned items are a grid.

import { displayTitle } from '@shared/format/item'
import { formatResultTime } from '@shared/format/time'
import type { DeskItem } from '@shared/types'
import { Icon } from '../shared/Icon'
import { ItemGlyph } from '../shared/ItemGlyph'
import { strings } from '../shared/strings'
import { useNow } from '../shared/useNow'
import styles from './DeskView.module.css'

export function DeskView({ items, loading }: { items: DeskItem[]; loading: boolean }): React.JSX.Element {
  const now = useNow()
  if (!loading && items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>{strings.empty.desk.title}</div>
        <div>{strings.empty.desk.body}</div>
      </div>
    )
  }
  return (
    <div className={styles.desk}>
      <div className={styles.heading}>Pinned items</div>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.id} className={styles.chip}>
            <button
              className={styles.open}
              onClick={() => void window.desk.act(item.id, 'open')}
              title={item.type === 'text' ? 'Copy' : 'Open'}
            >
              <ItemGlyph item={item} size={26} />
              <span className={`truncate ${item.metadata.mono ? styles.titleMono : styles.title}`}>{displayTitle(item)}</span>
              <span className={styles.date}>{formatResultTime(item.lastUsedAt, now)}</span>
            </button>
            <button
              className={styles.unpin}
              aria-label={`Unpin ${displayTitle(item)}`}
              title="Unpin"
              onClick={() => void window.desk.setPinned(item.id, false)}
            >
              <Icon name="pin" size={13} filled />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
