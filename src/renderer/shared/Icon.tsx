// Stroke icons from design/icons (DESIGN §4). Colored with currentColor.

import appMark from '@design/icons/app-mark.svg?raw'
import archive from '@design/icons/archive.svg?raw'
import calendar from '@design/icons/calendar.svg?raw'
import chevronDown from '@design/icons/chevron-down.svg?raw'
import close from '@design/icons/close.svg?raw'
import context from '@design/icons/context.svg?raw'
import database from '@design/icons/database.svg?raw'
import download from '@design/icons/download.svg?raw'
import folder from '@design/icons/folder.svg?raw'
import gear from '@design/icons/gear.svg?raw'
import keyboard from '@design/icons/keyboard.svg?raw'
import lock from '@design/icons/lock.svg?raw'
import pause from '@design/icons/pause.svg?raw'
import pin from '@design/icons/pin.svg?raw'
import search from '@design/icons/search.svg?raw'
import trash from '@design/icons/trash.svg?raw'
import typeFile from '@design/icons/type-file.svg?raw'
import typeImage from '@design/icons/type-image.svg?raw'
import typeLink from '@design/icons/type-link.svg?raw'
import typeScreenshot from '@design/icons/type-screenshot.svg?raw'
import typeText from '@design/icons/type-text.svg?raw'
import type { ItemType } from '@shared/types'

const ICONS = {
  'app-mark': appMark,
  archive,
  calendar,
  'chevron-down': chevronDown,
  close,
  context,
  database,
  download,
  folder,
  gear,
  keyboard,
  lock,
  pause,
  pin,
  search,
  trash,
  'type-file': typeFile,
  'type-image': typeImage,
  'type-link': typeLink,
  'type-screenshot': typeScreenshot,
  'type-text': typeText
} as const

export type IconName = keyof typeof ICONS

export function iconForType(type: ItemType): IconName {
  return `type-${type}` as IconName
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
  filled?: boolean
}

export function Icon({ name, size = 16, className, filled = false }: IconProps): React.JSX.Element {
  // Our own static SVG files — safe to inline.
  let svg = ICONS[name].replace('width="16" height="16"', `width="${size}" height="${size}"`)
  if (filled) svg = svg.replace('fill="none"', 'fill="currentColor"')
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
