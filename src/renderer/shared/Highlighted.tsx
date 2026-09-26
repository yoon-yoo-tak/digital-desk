import { splitHighlights } from '@shared/query/highlight'
import styles from './Highlighted.module.css'

/** Text with search matches marked (DESIGN §6.5: --match background, radius 3). */
export function Highlighted({ text, words }: { text: string; words: readonly string[] }): React.JSX.Element {
  if (words.length === 0) return <>{text}</>
  return (
    <>
      {splitHighlights(text, words).map((part, i) =>
        part.match ? (
          <mark key={i} className={styles.match}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}
