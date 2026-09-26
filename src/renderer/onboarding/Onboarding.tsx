// First run, four steps (DESIGN §10, Onboarding.dc.html). Nothing is captured until "Start".

import { useEffect, useState } from 'react'
import { tildifyUserPath } from '@shared/format/item'
import { formatAccelerator } from '@shared/format/shortcut'
import type { FolderAccess, Settings } from '@shared/types'
import { Icon } from '../shared/Icon'
import styles from './Onboarding.module.css'

const STEPS = 4

export function Onboarding(): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [folders, setFolders] = useState<FolderAccess[] | null>(null)

  useEffect(() => {
    void window.desk.settings.get().then(setSettings)
  }, [])

  // Step 3 reads the folders on purpose: that is what makes macOS ask for access now, in context.
  const checkFolders = (): void => {
    setFolders(null)
    void window.desk.onboarding.folders().then(setFolders)
  }
  useEffect(() => {
    if (step === 2) checkFolders()
  }, [step])

  const change = async (kind: FolderAccess['kind']): Promise<void> => {
    const path = await window.desk.settings.pickFolder(kind)
    if (!path) return
    await window.desk.settings.set(kind === 'screenshots' ? { screenshotFolder: path } : { downloadsFolder: path })
    checkFolders()
  }

  const next = (): void => setStep((s) => Math.min(STEPS - 1, s + 1))
  const last = step === STEPS - 1

  return (
    <div className={styles.window}>
      <div className={styles.dragBar} />
      <main className={styles.body}>
        {step === 0 && (
          <>
            <div className={styles.bigIcon}>
              <Icon name="app-mark" size={34} />
            </div>
            <h1 className={styles.title}>
              Digital Desk remembers
              <br />
              the things you touch.
            </h1>
            <p className={styles.text}>
              Copy, screenshot and download the way you always do.
              <br />
              Find any of it later from one search.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <div className={styles.bigIcon}>
              <Icon name="type-text" size={30} />
            </div>
            <h1 className={styles.title}>Clipboard</h1>
            <p className={styles.text}>Digital Desk watches your clipboard so you can find copied text, links and images later.</p>
            <div className={styles.localNote}>
              <Icon name="lock" size={14} className={styles.accentIcon} />
              Everything stays on this Mac. No account, no cloud.
            </div>
            <p className={styles.small}>Password managers and Keychain are never captured.</p>
          </>
        )}
        {step === 2 && (
          <div className={styles.folderStep}>
            <h1 className={styles.title}>Where do your files land?</h1>
            <p className={styles.text}>
              New screenshots and downloads there show up on your desk. Nothing is moved or copied.
            </p>
            <div className={styles.folders}>
              {(folders ?? []).map((f) => (
                <div key={f.kind} className={styles.folderRow}>
                  <Icon name={f.kind === 'screenshots' ? 'type-screenshot' : 'download'} size={18} className={styles.folderIcon} />
                  <div className={styles.folderText}>
                    <div className={styles.folderName}>{f.kind === 'screenshots' ? 'Screenshots' : 'Downloads'}</div>
                    {f.ok ? (
                      <div className={`mono ${styles.folderPath}`}>{tildifyUserPath(f.path)}</div>
                    ) : (
                      <button className={styles.denied} onClick={() => window.desk.ui.openPrivacySettings()}>
                        Access denied — Open System Settings
                      </button>
                    )}
                  </div>
                  <button className={styles.change} onClick={() => void change(f.kind)}>
                    Change…
                  </button>
                </div>
              ))}
              {!folders && <div className={styles.small}>Checking folders…</div>}
            </div>
            {folders?.some((f) => !f.ok) && (
              <button className={styles.retry} onClick={checkFolders}>
                Check again
              </button>
            )}
          </div>
        )}
        {step === 3 && (
          <>
            <h1 className={styles.title}>You’re ready.</h1>
            <p className={styles.text}>
              Copy something. Take a screenshot. Download a file.
              <br />
              We’ll remember it.
            </p>
            <div className={styles.shortcutBox}>
              <div className={styles.keys}>
                {splitKeys(formatAccelerator(settings?.quickSearchShortcut ?? 'CommandOrControl+Shift+Space')).map((k) => (
                  <span key={k} className={styles.key}>
                    {k}
                  </span>
                ))}
              </div>
              <div className={styles.shortcutText}>opens Quick Search from anywhere</div>
            </div>
          </>
        )}
      </main>
      <footer className={styles.footer}>
        <div className={styles.dots} aria-label={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i === step ? styles.dotOn : styles.dot} />
          ))}
        </div>
        {step > 0 && (
          <button className={styles.back} onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button
          className={last ? styles.start : styles.go}
          autoFocus
          onClick={() => (last ? void window.desk.onboarding.finish() : next())}
        >
          {last ? 'Start using Digital Desk' : 'Continue'}
        </button>
      </footer>
    </div>
  )
}

/** "⇧⌘Space" → ["⇧", "⌘", "Space"] for keycaps. */
function splitKeys(label: string): string[] {
  const m = /^([⌃⌥⇧⌘]*)(.*)$/u.exec(label)
  return [...(m?.[1] ?? '')].concat(m?.[2] ? [m[2]] : [])
}
