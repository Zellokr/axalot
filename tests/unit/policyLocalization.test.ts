import assert from 'node:assert/strict'
import test from 'node:test'
import { policyRuleTranslationId } from '../../app/utils/policyLocalization.ts'

const setAccessRule = {
  effect: 'allow',
  operation: 'set_access_level',
  changeTypes: ['grant', 'upgrade'],
  targetLevels: ['read', 'write'],
  subjects: { roles: ['support'], statuses: ['active'] },
  resources: { slugs: ['jira'] }
}

test('universal reduction rules use stable semantic translation ids', () => {
  assert.equal(policyRuleTranslationId('universal-access-reduction', {
    effect: 'allow',
    operation: 'set_access_level',
    changeTypes: ['downgrade'],
    subjects: {},
    resources: {}
  }), 'downgrade')
  assert.equal(policyRuleTranslationId('universal-access-reduction', {
    effect: 'allow',
    operation: 'revoke_access',
    changeTypes: ['revoke'],
    subjects: {},
    resources: {}
  }), 'revoke')
})

test('support rules are identified by resource and target-level semantics', () => {
  assert.equal(policyRuleTranslationId('support-operations', setAccessRule), 'jira')
  assert.equal(policyRuleTranslationId('support-operations', {
    ...setAccessRule,
    targetLevels: ['read'],
    resources: { slugs: ['vpn'] }
  }), 'vpnRead')
})

test('product rules are identified without their index or English reason', () => {
  assert.equal(policyRuleTranslationId('product-management', {
    ...setAccessRule,
    targetLevels: ['read', 'write', 'admin'],
    subjects: { roles: ['product_manager'], statuses: ['active'] }
  }), 'jira')
  assert.equal(policyRuleTranslationId('product-management', {
    ...setAccessRule,
    targetLevels: ['read'],
    subjects: { roles: ['product_manager'], statuses: ['active'] },
    resources: { slugs: ['github'] }
  }), 'githubRead')
})

test('effect and subject selectors prevent future rules from colliding with known translations', () => {
  assert.equal(policyRuleTranslationId('support-operations', {
    ...setAccessRule,
    effect: 'deny',
    subjects: { roles: ['developer'], statuses: ['inactive'] }
  }), null)
})

test('resource sensitivity prevents a future rule from reusing a known translation', () => {
  assert.equal(policyRuleTranslationId('support-operations', {
    ...setAccessRule,
    resources: { slugs: ['jira'], sensitive: false }
  }), null)
})

test('selector array order does not change an otherwise exact identity', () => {
  assert.equal(policyRuleTranslationId('support-operations', {
    ...setAccessRule,
    changeTypes: ['upgrade', 'grant'],
    targetLevels: ['write', 'read']
  }), 'jira')
})

test('remaining current rules retain their stable ids with exact authorization facts', () => {
  const cases = [
    ['inactive-privilege-growth', {
      effect: 'deny',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      subjects: { statuses: ['inactive'] },
      resources: {}
    }, 'privilegeGrowth'],
    ['engineering-collaboration', {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write'],
      subjects: { roles: ['developer'], statuses: ['active'] },
      resources: { slugs: ['github', 'jira', 'staging'] }
    }, 'collaboration'],
    ['qa-delivery', {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read', 'write'],
      subjects: { roles: ['qa'], statuses: ['active'] },
      resources: { slugs: ['jira', 'staging'] }
    }, 'delivery'],
    ['design-collaboration', {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['grant', 'upgrade'],
      targetLevels: ['read'],
      subjects: { roles: ['designer'], statuses: ['active'] },
      resources: { slugs: ['jira'] }
    }, 'jiraRead'],
    ['devops-platform', {
      effect: 'allow',
      operation: 'set_access_level',
      changeTypes: ['upgrade', 'grant'],
      targetLevels: ['admin', 'read', 'write'],
      subjects: {
        roles: ['devops'],
        levels: ['lead', 'senior'],
        statuses: ['active']
      },
      resources: { slugs: ['production', 'staging', 'vpn', 'github'] }
    }, 'platform']
  ] as const

  for (const [policyKey, rule, expectedId] of cases) {
    assert.equal(policyRuleTranslationId(policyKey, rule), expectedId)
  }
})

test('unknown policies and unknown rule shapes remain untranslated', () => {
  assert.equal(policyRuleTranslationId('future-policy', setAccessRule), null)
  assert.equal(policyRuleTranslationId('support-operations', {
    ...setAccessRule,
    resources: { slugs: ['future-resource'] }
  }), null)
})
