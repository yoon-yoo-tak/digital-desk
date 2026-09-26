import type { DeskItem } from '@shared/types'
import { Icon, iconForType } from './Icon'
import styles from './ItemGlyph.module.css'

export function assetUrl(relativePath: string): string {
  return `desk-asset://${relativePath}`
}

/** 32px icon tile, or a thumbnail for images (DESIGN §4). */
export function ItemGlyph({ item, size = 32 }: { item: DeskItem; size?: number }): React.JSX.Element {
  if (item.previewPath) {
    return (
      <span className={styles.thumb} style={{ width: size, height: size }}>
        <img src={assetUrl(item.previewPath)} alt="" draggable={false} />
      </span>
    )
  }
  return (
    <span className={styles.tile} style={{ width: size, height: size }}>
      <Icon name={iconForType(item.type)} size={size >= 32 ? 16 : 14} />
    </span>
  )
}
