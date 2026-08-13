import { AccessChangeType, AccessLevel } from '../helpers/validators'

export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
  [AccessLevel.Read]: 1,
  [AccessLevel.Write]: 2,
  [AccessLevel.Admin]: 3
}

export function classifyAccessChange(
  currentLevel: AccessLevel | null,
  targetLevel: AccessLevel
): Exclude<AccessChangeType, AccessChangeType.Revoke> {
  if (currentLevel === null) {
    return AccessChangeType.Grant
  }

  const currentRank = ACCESS_LEVEL_RANK[currentLevel]
  const targetRank = ACCESS_LEVEL_RANK[targetLevel]

  if (targetRank > currentRank) {
    return AccessChangeType.Upgrade
  }

  if (targetRank < currentRank) {
    return AccessChangeType.Downgrade
  }

  return AccessChangeType.Unchanged
}

export function isApprovalRequired(resource: { sensitive: boolean }) {
  return resource.sensitive
}
