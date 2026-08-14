const ACRONYMS = new Set(['qa'])

export function toLabel(value: string) {
  return value
    .split('_')
    .map(word => ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Audit actions are either legacy human-readable sentences ("Granted write
// access to GitHub") or newer snake_case codes ("access_granted"). Detect
// which and format accordingly instead of ever showing a raw snake_case code.
export function toAuditActionLabel(action: string) {
  if (action.startsWith('Granted') || action.startsWith('Revoked')) return action
  return toLabel(action)
}

export function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
