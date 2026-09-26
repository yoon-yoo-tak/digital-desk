import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeskItem, View } from '@shared/types'

const PAGE = 100

interface ItemsState {
  items: DeskItem[]
  loading: boolean
  hasMore: boolean
  loadMore: () => void
}

/** Paged list for a view that refreshes itself when the main process reports changes. */
export function useItems(view: View): ItemsState {
  const [items, setItems] = useState<DeskItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadedCount = useRef(0)
  const generation = useRef(0)

  // Re-reads everything currently loaded, so prepended items don't push others off the list.
  const refresh = useCallback(async () => {
    const gen = ++generation.current
    const limit = Math.max(PAGE, loadedCount.current)
    const page = await window.desk.listItems(view, null, limit)
    if (gen !== generation.current) return
    loadedCount.current = page.items.length
    setItems(page.items)
    setCursor(page.nextCursor)
    setLoading(false)
  }, [view])

  useEffect(() => {
    loadedCount.current = 0
    setItems([])
    setLoading(true)
    void refresh()
    return window.desk.on('items-changed', () => void refresh())
  }, [refresh])

  const loadMore = useCallback(() => {
    if (!cursor || loading) return
    setLoading(true)
    const gen = generation.current
    void window.desk.listItems(view, cursor, PAGE).then((page) => {
      if (gen !== generation.current) return
      setItems((prev) => {
        const next = [...prev, ...page.items]
        loadedCount.current = next.length
        return next
      })
      setCursor(page.nextCursor)
      setLoading(false)
    })
  }, [cursor, loading, view])

  return { items, loading, hasMore: cursor !== null, loadMore }
}
