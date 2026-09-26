import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaptureStatus, DeskItem, View } from '@shared/types'
import styles from './App.module.css'
import { DeskView } from './DeskView'
import { Inspector } from './Inspector'
import { Timeline } from './Timeline'
import { Toolbar } from './Toolbar'
import { useItems } from './useItems'

const VIEW_KEYS: Record<string, View> = { '1': 'inbox', '2': 'desk', '3': 'archive' }

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('inbox')
  const [status, setStatus] = useState<CaptureStatus | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { items, loading, hasMore, loadMore } = useItems(view)
  const [toast, setToast] = useState<{ message: string; undoToken?: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((message: string, undoToken?: string) => {
    clearTimeout(toastTimer.current)
    setToast({ message, undoToken })
    toastTimer.current = setTimeout(() => setToast(null), 5000) // = the undo window in main
  }, [])

  /** ⌘⌫ / trash button: delete now, undo for 5 s (DESIGN §7.2). */
  const deleteItem = useCallback(
    async (item: DeskItem) => {
      const result = await window.desk.deleteItem(item.id)
      if (result) showToast('Deleted from Desk', result.undoToken)
    },
    [showToast]
  )

  const undo = useCallback(async () => {
    if (!toast?.undoToken) return
    await window.desk.undoDelete(toast.undoToken)
    clearTimeout(toastTimer.current)
    setToast(null)
  }, [toast])

  const archiveItem = useCallback(
    async (item: DeskItem, archived: boolean) => {
      await window.desk.setArchived(item.id, archived)
      showToast(archived ? 'Archived — still searchable' : 'Moved back to Inbox')
    },
    [showToast]
  )

  useEffect(() => {
    void window.desk.capture.status().then(setStatus)
    return window.desk.on('capture-status', setStatus)
  }, [])

  // Keep a valid selection: default to the newest item, fall back when the selected one disappears.
  const selected: DeskItem | null = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  )

  const changeView = useCallback((next: View) => {
    setView(next)
    setSelectedId(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'z' && toast?.undoToken) {
        e.preventDefault()
        void undo()
        return
      }
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.desk.ui.openQuickSearch()
        return
      }
      const next = e.metaKey && !e.shiftKey && !e.altKey ? VIEW_KEYS[e.key] : undefined
      if (next) {
        e.preventDefault()
        changeView(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeView, toast, undo])

  return (
    <div className={styles.app}>
      <Toolbar view={view} onViewChange={changeView} status={status} />
      <div className={styles.body}>
        {view === 'desk' ? (
          <DeskView items={items} loading={loading} />
        ) : (
          <>
            <Timeline
              view={view}
              items={items}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onDelete={(item) => void deleteItem(item)}
              onArchive={(item, archived) => void archiveItem(item, archived)}
            />
            <Inspector item={selected} onDelete={(item) => void deleteItem(item)} />
          </>
        )}
      </div>
      {toast && (
        <div className={styles.toast} role="status">
          {toast.message}
          {toast.undoToken && (
            <button className={styles.toastUndo} onClick={() => void undo()}>
              Undo ⌘Z
            </button>
          )}
        </div>
      )}
    </div>
  )
}
