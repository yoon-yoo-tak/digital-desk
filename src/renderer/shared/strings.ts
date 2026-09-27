// All UI copy in one place (DESIGN §5: English UI, i18n-ready).

import { CAPTURE_STRINGS } from '@shared/format/capture'

export const strings = {
  appName: 'Digital Desk',
  views: { inbox: 'Inbox', desk: 'Desk', archive: 'Archive' },
  search: 'Search',
  capture: CAPTURE_STRINGS,
  empty: {
    inbox: { title: 'Nothing here yet.', body: 'Copy something, take a screenshot, or download a file.' },
    desk: { title: 'Your desk is clear.', body: "Pin things you're working on to keep them here. ⌘P" },
    archive: { title: 'Nothing archived.', body: 'Archived items stay searchable.' }
  },
  inspector: {
    source: 'Source',
    original: 'Original',
    url: 'URL',
    size: 'Size',
    from: 'From',
    copied: 'Copied',
    text: 'Text',
    missing: 'Missing',
    open: 'Open',
    copy: 'Copy',
    reveal: 'Reveal',
    pin: 'Pin',
    unpin: 'Unpin',
    delete: 'Delete from Desk',
    nothingSelected: 'Select an item to see it here.'
  }
} as const
