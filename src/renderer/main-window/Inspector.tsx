import { displayTitle, formatBytes, tildifyUserPath, typeLabel } from '@shared/format/item'
import { formatInspectorTime } from '@shared/format/time'
import type { DeskItem, ItemAction } from '@shared/types'
import { Icon, iconForType } from '../shared/Icon'
import { assetUrl } from '../shared/ItemGlyph'
import { strings } from '../shared/strings'
import { useNow } from '../shared/useNow'
import styles from './Inspector.module.css'

interface ActionButton {
  label: string
  action: ItemAction
}

/** Primary + secondary actions per type (DESIGN §6.7, §7.3). */
function actionsFor(item: DeskItem): [ActionButton, ActionButton | null] {
  const s = strings.inspector
  switch (item.type) {
    case 'text':
      return [{ label: s.copy, action: 'copy' }, null]
    case 'link':
    case 'image':
      return [
        { label: s.open, action: 'open' },
        { label: s.copy, action: 'copy' }
      ]
    case 'file':
    case 'screenshot':
      return [
        { label: s.open, action: 'open' },
        { label: s.reveal, action: 'reveal' }
      ]
  }
}

function Preview({ item }: { item: DeskItem }): React.JSX.Element {
  if (item.type === 'text') {
    return (
      <div className={`${styles.textPreview} ${item.metadata.mono ? 'mono' : ''}`} style={{ userSelect: 'text' }}>
        {item.text}
      </div>
    )
  }
  if (item.type === 'link') {
    return (
      <div className={styles.linkPreview}>
        <div className={styles.linkDomain}>{item.domain}</div>
        <div className={styles.linkTitle}>{displayTitle(item)}</div>
        <div className={`mono ${styles.linkUrl}`} style={{ userSelect: 'text' }}>
          {item.url}
        </div>
      </div>
    )
  }
  if (item.previewPath) {
    return (
      <div className={styles.imagePreview}>
        <img src={assetUrl(item.previewPath)} alt="" draggable={false} />
      </div>
    )
  }
  return (
    <div className={styles.iconPreview}>
      <Icon name={iconForType(item.type)} size={40} />
    </div>
  )
}

export function Inspector({
  item,
  onDelete
}: {
  item: DeskItem | null
  onDelete: (item: DeskItem) => void
}): React.JSX.Element {
  const now = useNow()
  if (!item) {
    return (
      <aside aria-label="Inspector" className={styles.inspector}>
        <div className={styles.placeholder}>{strings.inspector.nothingSelected}</div>
      </aside>
    )
  }

  const s = strings.inspector
  const missing = item.metadata.missing === true
  const [primary, secondary] = actionsFor(item)
  const needsFile = (a: ItemAction): boolean => a !== 'copy' || item.type === 'file' || item.type === 'screenshot'
  const act = (action: ItemAction) => () => void window.desk.act(item.id, action)

  const rows: [string, React.ReactNode][] = []
  if (item.sourceApp) rows.push([s.source, item.sourceApp])
  if (item.filePath) {
    rows.push([
      s.original,
      <span className={styles.pathValue} key="path">
        <span className="truncate mono">{tildifyUserPath(item.filePath)}</span>
        {missing && <span className={styles.missing}>{s.missing}</span>}
      </span>
    ])
  }
  const { width, height, size } = item.metadata
  if ((item.type === 'image' || item.type === 'screenshot') && width && height) {
    rows.push([s.size, `${width} × ${height}`])
  } else if (size !== undefined) {
    rows.push([s.size, formatBytes(size)])
  }
  if (item.type === 'file' && item.domain) rows.push([s.from, item.domain])
  if (item.useCount > 1) {
    rows.push([s.copied, `${item.useCount} times · first ${formatInspectorTime(item.capturedAt, now)}`])
  }

  return (
    <aside aria-label="Inspector" className={styles.inspector}>
      <Preview item={item} />
      <div>
        <div className={`truncate ${styles.title}`}>{displayTitle(item)}</div>
        <div className={styles.subtitle}>
          {typeLabel(item)} · {formatInspectorTime(item.lastUsedAt, now)}
        </div>
      </div>
      {rows.length > 0 && (
        <dl className={styles.meta}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.metaRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.ocrText && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Text in image</div>
          <div className={`mono ${styles.ocr}`}>{item.ocrText}</div>
        </section>
      )}
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button className={styles.primary} onClick={act(primary.action)} disabled={missing && needsFile(primary.action)}>
          {primary.label}
        </button>
        {secondary && (
          <button
            className={styles.secondary}
            onClick={act(secondary.action)}
            disabled={missing && needsFile(secondary.action)}
          >
            {secondary.label}
          </button>
        )}
        <button className={styles.secondary} onClick={() => void window.desk.setPinned(item.id, !item.pinned)}>
          {item.pinned ? s.unpin : s.pin}
        </button>
        <button className={styles.iconButton} aria-label={s.delete} title={s.delete} onClick={() => onDelete(item)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </aside>
  )
}
