const ACRONYMS = new Set(['qa'])

export const AUDIT_ACTION_KEYS: Record<string, string> = {
  access_granted: 'audit.actions.accessGranted',
  access_upgraded: 'audit.actions.accessUpgraded',
  access_downgraded: 'audit.actions.accessDowngraded',
  access_revoked: 'audit.actions.accessRevoked',
  access_unchanged: 'audit.actions.accessUnchanged',
  access_policy_denied: 'audit.actions.accessPolicyDenied',
  approval_created: 'audit.actions.approvalCreated',
  approval_reused: 'audit.actions.approvalReused',
  approval_approved: 'audit.actions.approvalApproved',
  approval_rejected: 'audit.actions.approvalRejected',
  approval_expired: 'audit.actions.approvalExpired',
  approval_stale: 'audit.actions.approvalStale',
  approval_policy_changed: 'audit.actions.approvalPolicyChanged',
  proposal_created: 'audit.actions.proposalCreated',
  proposal_executed: 'audit.actions.proposalExecuted',
  proposal_cancelled: 'audit.actions.proposalCancelled',
  proposal_expired: 'audit.actions.proposalExpired',
  proposal_stale: 'audit.actions.proposalStale',
  proposal_invalidated: 'audit.actions.proposalInvalidated',
  proposal_policy_denied: 'audit.actions.proposalPolicyDenied',
  proposal_policy_changed: 'audit.actions.proposalPolicyChanged',
  policy_activated: 'audit.actions.policyActivated',
  policy_deactivated: 'audit.actions.policyDeactivated',
  agent_conversation_cleared: 'audit.actions.agentConversationCleared'
}

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

export function formatDateTime(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
