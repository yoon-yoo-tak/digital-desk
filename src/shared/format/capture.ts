import type { CaptureStatus } from '../types'

export const CAPTURE_STRINGS = {
  capturing: 'Capturing',
  paused: 'Paused',
  unavailable: 'Clipboard unavailable',
  unavailableDetail: 'Clipboard capture is stopped because the source app cannot be verified. Restart Digital Desk to retry.',
  starting: 'Starting clipboard',
  setup: 'Not capturing yet',
  off: 'Not capturing'
}

/** Status text must not promise clipboard capture while its privacy checks are unavailable. */
export function captureLabel(status: CaptureStatus | null): string {
  if (!status) return CAPTURE_STRINGS.starting
  if (!status.onboarded) return CAPTURE_STRINGS.setup
  if (status.paused) return CAPTURE_STRINGS.paused
  if (status.sources.clipboard && status.helper !== 'running') {
    return status.helper === 'starting' ? CAPTURE_STRINGS.starting : CAPTURE_STRINGS.unavailable
  }
  return Object.values(status.sources).some(Boolean) ? CAPTURE_STRINGS.capturing : CAPTURE_STRINGS.off
}
