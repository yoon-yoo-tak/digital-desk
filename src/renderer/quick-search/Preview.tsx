import { displayTitle, formatBytes, tildifyUserPath, typeLabel } from '@shared/format/item'
import { formatInspectorTime } from '@shared/format/time'
import type { SearchHit } from '@shared/types'
import { Highlighted } from '../shared/Highlighted'
import { Icon, iconForType } from '../shared/Icon'
import { assetUrl } from '../shared/ItemGlyph'
import { previewButtons, type ButtonSpec } from './model'
import styles from './QuickSearch.module.css'

interface Props {
  hit: SearchHit
  words: readonly string[]
  /** "5 items · 14:03 – 14:16" when the item belongs to the top match's session. */
  session: string | null
  now: number
  onButton: (spec: ButtonSpec) => void
  onTogglePin: () => void
}

/** Right-hand preview (DESIGN §6.6). */
export function Preview({ hit, words, session, now, onButton, onTogglePin }: Props): React.JSX.Element {
  const { item } = hit
  const missing = item.metadata.missing === true
  const [primary, secondary] = previewButtons(item.type)
  const needsFile = (spec: ButtonSpec): boolean =>
    spec.action !== 'copy' || item.type === 'file' || item.type === 'screenshot'
  const subtitle = [typeLabel(item), item.sourceApp, formatInspectorTime(item.lastUsedAt, now)].filter(Boolean).join(' · ')
  const title =
    item.type === 'screenshot' && item.fileName ? item.fileName.replace(/\.[a-z0-9]+$/iu, '') : displayTitle(item)

  const meta: [string, React.ReactNode][] = []
  if (item.filePath) {
    meta.push([
      'Original',
      <span key="p" className={styles.pathValue}>
        <span className="truncate mono">{tildifyUserPath(item.filePath)}</span>
        {missing && <span className={styles.missing}>Missing</span>}
      </span>
    ])
  }
  if (item.type === 'file' && item.metadata.size !== undefined) meta.push(['Size', formatBytes(item.metadata.size)])
  if (item.type === 'file' && item.domain) meta.push(['From', item.domain])
  if (item.useCount > 1) meta.push(['Copied', `${item.useCount} times`])
  if (session) meta.push(['Session', session])

  return (
    <div className={styles.preview}>
      <div className={styles.previewContent}>
      {item.type === 'text' && (
        <div className={`${styles.previewText} ${item.metadata.mono ? 'mono' : ''}`}>
          <Highlighted text={item.text ?? ''} words={words} />
        </div>
      )}
      {item.type === 'link' && (
        <div className={styles.previewLink}>
          <div className={styles.previewCaps}>{item.domain}</div>
          <div className={styles.previewLinkTitle}>
            <Highlighted text={displayTitle(item)} words={words} />
          </div>
          <div className={`mono ${styles.previewUrl}`}>
            <Highlighted text={item.url ?? ''} words={words} />
          </div>
        </div>
      )}
      {(item.type === 'screenshot' || item.type === 'image' || item.type === 'file') &&
        (item.previewPath ? (
          <div className={styles.previewImage}>
            <img src={assetUrl(item.previewPath)} alt="" draggable={false} />
          </div>
        ) : (
          <div className={styles.previewIcon}>
            <Icon name={iconForType(item.type)} size={40} />
          </div>
        ))}

      {item.type !== 'link' && (
        <div>
          <div className={`truncate ${styles.previewTitle}`}>
            <Highlighted text={title} words={words} />
          </div>
          <div className={styles.previewSubtitle}>{subtitle}</div>
        </div>
      )}
      {item.type === 'link' && <div className={styles.previewSubtitle}>{subtitle}</div>}

      {item.type === 'screenshot' && hit.excerpt && (
        <div className={styles.ocrBox}>
          <div className={styles.previewCaps}>Text in image</div>
          <div className={`mono ${styles.ocrText}`}>
            <Highlighted text={hit.excerpt} words={words} />
          </div>
        </div>
      )}

      {meta.length > 0 && (
        <dl className={styles.metaGrid}>
          {meta.map(([label, value]) => (
            <div key={label} className={styles.metaRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      </div>
      <div className={styles.buttons}>
        <button
          className={styles.primaryButton}
          disabled={missing && needsFile(primary)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onButton(primary)}
        >
          {primary.label}
        </button>
        {secondary && (
          <button
            className={styles.secondaryButton}
            disabled={missing && needsFile(secondary)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onButton(secondary)}
          >
            {secondary.label}
          </button>
        )}
        <div className={styles.spacer} />
        <button
          className={item.pinned ? styles.pinButtonActive : styles.pinButton}
          aria-label={item.pinned ? 'Unpin from Desk' : 'Pin to Desk'}
          title={item.pinned ? 'Unpin  ⌘P' : 'Pin to Desk  ⌘P'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onTogglePin}
        >
          <Icon name="pin" size={14} filled={item.pinned} />
        </button>
      </div>
    </div>
  )
}
