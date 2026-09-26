import { monotonicFactory } from 'ulid'

/**
 * Item ids: ULIDs that keep increasing even within the same millisecond, so
 * "newest first" ordering (last_used_at DESC, id DESC) is stable for burst captures.
 */
export const newItemId: (time: number) => string = monotonicFactory()
