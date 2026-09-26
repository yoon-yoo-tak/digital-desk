import { useCallback, useEffect, useState } from 'react'
import { formatBytes, tildifyUserPath } from '@shared/format/item'
import { acceleratorFromKey, formatAccelerator } from '@shared/format/shortcut'
import type { Settings as SettingsModel, SettingsTab, ShortcutStatus, StorageInfo } from '@shared/types'
import { Icon, type IconName } from '../shared/Icon'
import { Group, Row, Segmented, SmallButton, Toggle } from './controls'
import styles from './Settings.module.css'

const TABS: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'gear' },
  { id: 'capture', label: 'Capture', icon: 'app-mark' },
  { id: 'privacy', label: 'Privacy', icon: 'lock' },
  { id: 'storage', label: 'Storage', icon: 'database' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' }
]

type Update = (patch: Partial<SettingsModel>) => void

export function Settings(): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('capture')
  const [settings, setSettings] = useState<SettingsModel | null>(null)

  useEffect(() => {
    void window.desk.settings.get().then(setSettings)
    const offChanged = window.desk.on('settings-changed', setSettings)
    const offTab = window.desk.on('open-settings-tab', setTab)
    return () => {
      offChanged()
      offTab()
    }
  }, [])

  // Applied immediately — there is no Save button (DESIGN §9).
  const update: Update = useCallback((patch) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    void window.desk.settings.set(patch)
  }, [])

  const current = TABS.find((t) => t.id === tab) as (typeof TABS)[number]
  return (
    <div className={styles.window}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>{current.label}</div>
        <div role="tablist" aria-label="Settings" className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              className={t.id === tab ? styles.tabOn : styles.tab}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
            </button>
          ))}
        </div>
      </header>
      {settings && (
        <main className={styles.content}>
          {tab === 'general' && <General settings={settings} update={update} />}
          {tab === 'capture' && <Capture settings={settings} update={update} />}
          {tab === 'privacy' && <Privacy settings={settings} update={update} />}
          {tab === 'storage' && <Storage />}
          {tab === 'shortcuts' && <Shortcuts settings={settings} update={update} />}
        </main>
      )}
    </div>
  )
}

interface TabProps {
  settings: SettingsModel
  update: Update
}

function General({ settings, update }: TabProps): React.JSX.Element {
  return (
    <>
      <Group title="Startup">
        <Row title="Launch at login" sub="Keep capturing after you restart your Mac.">
          <Toggle label="Launch at login" checked={settings.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
        </Row>
      </Group>
      <Group title="Appearance">
        <Row title="Main window" sub="Quick Search always uses the dark panel.">
          <Segmented
            label="Appearance"
            value={settings.appearance}
            onChange={(v) => update({ appearance: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' }
            ]}
          />
        </Row>
      </Group>
      <Group title="Quick Search">
        <Row title="Open from anywhere" sub="Change it in Shortcuts.">
          <span className={styles.kbd}>{formatAccelerator(settings.quickSearchShortcut)}</span>
        </Row>
      </Group>
    </>
  )
}

function Capture({ settings, update }: TabProps): React.JSX.Element {
  const setSource = (key: keyof SettingsModel['sources'], value: boolean): void =>
    update({ sources: { ...settings.sources, [key]: value } })
  const pickFolder = async (kind: 'screenshots' | 'downloads'): Promise<void> => {
    const path = await window.desk.settings.pickFolder(kind)
    if (path) update(kind === 'screenshots' ? { screenshotFolder: path } : { downloadsFolder: path })
  }
  const addApp = async (): Promise<void> => {
    const app = await window.desk.settings.pickApp()
    if (app && !settings.excludedApps.some((a) => a.bundleId === app.bundleId)) {
      update({ excludedApps: [...settings.excludedApps, app] })
    }
  }
  const [selectedApp, setSelectedApp] = useState<string | null>(null)

  return (
    <>
      <Group title="Sources">
        <Row title="Clipboard" sub="Text, links, images and copied files">
          <Toggle label="Clipboard" checked={settings.sources.clipboard} onChange={(v) => setSource('clipboard', v)} />
        </Row>
        <Row title="Screenshots" sub={settings.screenshotFolder ? tildifyUserPath(settings.screenshotFolder) : 'Where macOS saves screenshots'} mono={!!settings.screenshotFolder}>
          <SmallButton onClick={() => void pickFolder('screenshots')}>Change…</SmallButton>
          <Toggle label="Screenshots" checked={settings.sources.screenshots} onChange={(v) => setSource('screenshots', v)} />
        </Row>
        <Row title="Downloads" sub={tildifyUserPath(settings.downloadsFolder ?? '~/Downloads')} mono>
          <SmallButton onClick={() => void pickFolder('downloads')}>Change…</SmallButton>
          <Toggle label="Downloads" checked={settings.sources.downloads} onChange={(v) => setSource('downloads', v)} />
        </Row>
        <Row title="Read text in screenshots" sub="On-device OCR, English and Korean">
          <Toggle label="Read text in screenshots" checked={settings.ocrEnabled} onChange={(v) => update({ ocrEnabled: v })} />
        </Row>
      </Group>

      <Group title="Never capture from">
        {settings.excludedApps.map((app) => (
          <button
            key={app.bundleId}
            className={selectedApp === app.bundleId ? styles.appRowOn : styles.appRow}
            onClick={() => setSelectedApp(app.bundleId)}
          >
            <span className={styles.appTile}>{app.name.slice(0, 1)}</span>
            <span className={styles.rowText}>{app.name}</span>
            <span className={`${styles.sub} mono`}>{app.bundleId}</span>
          </button>
        ))}
        <div className={styles.listFooter}>
          <button className={styles.plusMinus} aria-label="Add app" onClick={() => void addApp()}>
            +
          </button>
          <button
            className={styles.plusMinus}
            aria-label="Remove app"
            disabled={!selectedApp}
            onClick={() => {
              update({ excludedApps: settings.excludedApps.filter((a) => a.bundleId !== selectedApp) })
              setSelectedApp(null)
            }}
          >
            −
          </button>
          <div className={styles.listNote}>Copies made in these apps are ignored, even while capturing.</div>
        </div>
      </Group>

      <Group title="Keep unpinned items">
        <div className={styles.rowTall}>
          <Segmented
            label="Keep unpinned items"
            value={settings.retentionDays}
            onChange={(v) => update({ retentionDays: v })}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
              { value: null, label: 'Forever' }
            ]}
          />
        </div>
        <Row
          sub="Clipboard text expires after this. Screenshots and downloads keep their record; the files themselves are never touched. Pinned and archived items stay until you remove them."
        />
      </Group>
    </>
  )
}

function Privacy({ settings, update }: TabProps): React.JSX.Element {
  const [result, setResult] = useState<string | null>(null)
  const remove = async (minutes: number): Promise<void> => {
    const n = await window.desk.capture.deleteRecent(minutes)
    setResult(n > 0 ? `Deleted ${n} ${n === 1 ? 'item' : 'items'}.` : null)
  }
  return (
    <>
      <Group title="Network">
        <Row
          title="Fetch link titles"
          sub="Loads the page title for copied public links. Local and private addresses are never fetched."
        >
          <Toggle label="Fetch link titles" checked={settings.fetchLinkTitles} onChange={(v) => update({ fetchLinkTitles: v })} />
        </Row>
      </Group>
      <Group title="Delete">
        <Row title="Captured by mistake?" sub={result ?? 'Only Desk records are removed. Files on disk are not touched.'}>
          <SmallButton onClick={() => void remove(5)}>Last 5 minutes…</SmallButton>
          <SmallButton onClick={() => void remove(60)}>Last hour…</SmallButton>
          <SmallButton onClick={() => void remove(Infinity)}>Everything…</SmallButton>
        </Row>
      </Group>
      <Group title="Where your data is">
        <Row sub="Everything stays on this Mac. There is no account, no server and no telemetry." />
      </Group>
    </>
  )
}

function Storage(): React.JSX.Element {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  useEffect(() => {
    void window.desk.settings.storageInfo().then(setInfo)
  }, [])
  if (!info) return <></>
  return (
    <Group title="Storage">
      <Row title="Location" sub={tildifyUserPath(info.path)} mono>
        <SmallButton onClick={() => window.desk.settings.revealData()}>Reveal in Finder</SmallButton>
      </Row>
      <Row title="Items">{info.items.toLocaleString('en-US')}</Row>
      <Row title="Database">{formatBytes(info.databaseBytes)}</Row>
      <Row title="Images and thumbnails">{formatBytes(info.assetsBytes)}</Row>
    </Group>
  )
}

function ShortcutField({
  label,
  value,
  ok,
  onChange
}: {
  label: string
  value: string
  ok: boolean
  onChange: (accelerator: string) => void
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  return (
    <button
      aria-label={`${label} shortcut`}
      className={recording ? styles.shortcutRecording : ok ? styles.shortcut : styles.shortcutError}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return
        e.preventDefault()
        if (e.key === 'Escape') return setRecording(false)
        const accelerator = acceleratorFromKey(e.nativeEvent)
        if (accelerator) {
          onChange(accelerator)
          setRecording(false)
        }
      }}
    >
      {recording ? 'Type a shortcut…' : formatAccelerator(value)}
    </button>
  )
}

function Shortcuts({ settings, update }: TabProps): React.JSX.Element {
  const [status, setStatus] = useState<ShortcutStatus>({ quickSearch: true, pause: true })
  useEffect(() => {
    void window.desk.settings.shortcutStatus().then(setStatus)
  }, [settings.quickSearchShortcut, settings.pauseShortcut])
  const taken = 'Another app or an input-source shortcut already uses this. Pick another.'
  return (
    <Group title="Global shortcuts">
      <Row title="Quick Search" sub={status.quickSearch ? 'Opens the search panel from any app.' : taken}>
        <ShortcutField
          label="Quick Search"
          value={settings.quickSearchShortcut}
          ok={status.quickSearch}
          onChange={(v) => update({ quickSearchShortcut: v })}
        />
      </Row>
      <Row title="Pause / resume capture" sub={status.pause ? 'Stops recording until you press it again.' : taken}>
        <ShortcutField
          label="Pause"
          value={settings.pauseShortcut}
          ok={status.pause}
          onChange={(v) => update({ pauseShortcut: v })}
        />
      </Row>
    </Group>
  )
}
