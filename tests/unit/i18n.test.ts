import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value)
    .flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}

test('i18n foundation configures persistent no-prefix English and Spanish locales', async () => {
  const [config, vueI18nConfig] = await Promise.all([
    readFile(new URL('../../nuxt.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../i18n/i18n.config.ts', import.meta.url), 'utf8')
  ])

  assert.ok(config.indexOf(`'@nuxtjs/i18n'`) > config.indexOf(`'@nuxt/ui'`))
  assert.match(config, /strategy:\s*'no_prefix'/)
  assert.match(config, /defaultLocale:\s*'en'/)
  assert.match(config, /code:\s*'en'[\s\S]*file:\s*'en\.json'/)
  assert.match(config, /code:\s*'es'[\s\S]*file:\s*'es\.json'/)
  assert.match(config, /cookieKey:\s*'axalot_locale'/)
  assert.match(config, /fallbackLocale:\s*'en'/)
  assert.match(config, /useCookie:\s*true/)
  assert.match(config, /redirectOn:\s*'all'/)
  assert.match(vueI18nConfig, /defineI18nConfig\(\(\)\s*=>/)
  assert.match(vueI18nConfig, /fallbackLocale:\s*'en'/)
})

test('English and Spanish catalogs have exact semantic-key parity', async () => {
  const [english, spanish] = await Promise.all([
    readFile(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../i18n/locales/es.json', import.meta.url), 'utf8').then(JSON.parse)
  ])

  const englishKeys = leafKeys(english)
  const spanishKeys = leafKeys(spanish)

  assert.ok(englishKeys.length > 0)
  assert.deepEqual(spanishKeys, englishKeys)
  assert.ok(englishKeys.every(key => /^[a-z][a-zA-Z0-9-]*(\.[a-z][a-zA-Z0-9-]*)+$/.test(key)))
  assert.equal(english.agent.errors.toolIncomplete, 'Tool call did not complete')
  assert.equal(spanish.agent.errors.toolIncomplete, 'La llamada a la herramienta no se completó')
})

test('known policy catalog entries have localized titles, descriptions, and rule reasons', async () => {
  const [english, spanish] = await Promise.all([
    readFile(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../i18n/locales/es.json', import.meta.url), 'utf8').then(JSON.parse)
  ])
  const expectedRules = {
    'inactive-privilege-growth': ['privilegeGrowth'],
    'universal-access-reduction': ['downgrade', 'revoke'],
    'engineering-collaboration': ['collaboration'],
    'qa-delivery': ['delivery'],
    'support-operations': ['jira', 'vpnRead'],
    'design-collaboration': ['jiraRead'],
    'product-management': ['jira', 'githubRead'],
    'devops-platform': ['platform']
  }

  for (const catalog of [english.policies.catalog, spanish.policies.catalog]) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(expectedRules).sort())

    for (const [policyKey, ruleIds] of Object.entries(expectedRules)) {
      assert.equal(typeof catalog[policyKey].title, 'string')
      assert.equal(typeof catalog[policyKey].description, 'string')
      assert.deepEqual(Object.keys(catalog[policyKey].rules).sort(), ruleIds.sort())
    }
  }

  assert.equal(Object.values(expectedRules).flat().length, 11)
  assert.equal(spanish.policies.catalog['support-operations'].rules.vpnRead, 'Los empleados de Soporte activos pueden recibir acceso de lectura a VPN.')
  assert.equal(spanish.policies.catalog['product-management'].rules.githubRead, 'Los responsables de producto activos pueden leer GitHub.')
})

test('UApp and the persistent language button synchronize Nuxt UI and document locale', async () => {
  const dashboardPagePaths = [
    '../../app/pages/agent/index.vue',
    '../../app/pages/audit-log/index.vue',
    '../../app/pages/employees/[id].vue',
    '../../app/pages/employees/index.vue',
    '../../app/pages/index.vue',
    '../../app/pages/learn/index.vue',
    '../../app/pages/permissions/index.vue',
    '../../app/pages/policies/index.vue',
    '../../app/pages/resources/[id].vue',
    '../../app/pages/resources/index.vue'
  ]
  const [app, button, layout, dashboardPages] = await Promise.all([
    readFile(new URL('../../app/app.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/AppLanguageButton.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8'),
    Promise.all(dashboardPagePaths.map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  ])

  assert.match(app, /import\s+{\s*en,\s*es\s*}\s+from\s+'@nuxt\/ui\/locale'/)
  assert.match(app, /<UApp\s+:locale="uiLocale"/)
  assert.match(app, /htmlAttrs:[\s\S]*lang:[\s\S]*dir:/)

  assert.match(button, /const\s+{\s*locale,\s*setLocale,\s*t\s*}\s*=\s*useI18n\(\)/)
  assert.match(button, /setLocale\(targetLocale\.value\)/)
  assert.match(button, /<UButton/)
  assert.match(button, /icon="i-lucide-languages"/)
  assert.match(button, /:label="targetCode"/)
  assert.match(button, /:aria-label="targetLabel"/)
  assert.doesNotMatch(button, /collapsed/)

  const sidebar = layout.match(/<UDashboardSidebar[\s\S]*?<\/UDashboardSidebar>/)?.[0]
  const globalHeader = layout.match(/<header[\s\S]*?<\/header>/)?.[0]

  assert.ok(sidebar)
  assert.ok(globalHeader)
  assert.doesNotMatch(sidebar, /AppLanguageButton|UColorModeButton|#footer/)
  assert.match(globalHeader, /<AppLanguageButton\s*\/>/)
  assert.match(globalHeader, /<UColorModeButton\s*\/>/)
  assert.equal((layout.match(/<AppLanguageButton\b/g) ?? []).length, 1)
  assert.equal((layout.match(/<UColorModeButton\b/g) ?? []).length, 1)
  assert.ok(layout.indexOf('</UDashboardSidebar>') < layout.indexOf('<header'))
  assert.match(layout, /class="flex min-h-0 min-w-0 flex-1 flex-col"/)
  assert.match(layout, /<main\s+class="flex min-h-0 flex-1 overflow-hidden[^"]*"/)

  for (const page of dashboardPages) {
    assert.match(page, /<UDashboardNavbar/)
    assert.doesNotMatch(page, /AppLanguageButton|UColorModeButton/)
  }
})

test('core dashboard pages use semantic translation keys and the active date locale', async () => {
  const [english, pages] = await Promise.all([
    readFile(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
    Promise.all([
      '../../app/pages/index.vue',
      '../../app/pages/employees/index.vue',
      '../../app/pages/employees/[id].vue',
      '../../app/pages/resources/index.vue',
      '../../app/pages/resources/[id].vue',
      '../../app/pages/permissions/index.vue'
    ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  ])

  for (const domain of ['overview', 'employees', 'resources', 'permissions']) {
    assert.match(english, new RegExp(`"${domain}"\\s*:`))
  }
  for (const page of pages) assert.match(page, /useI18n\(\)/)
  for (const detail of [pages[2]!, pages[4]!, pages[5]!]) {
    assert.match(detail, /formatDateTime\([^\n]+,\s*dateLocale\)/)
  }
})

test('Agent and governance UI translate static chrome while preserving dynamic Convex content', async () => {
  const [english, agent, audit, policies, learn, layout, helper] = await Promise.all([
    readFile(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
    readFile(new URL('../../app/pages/agent/index.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/pages/audit-log/index.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/pages/policies/index.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/pages/learn/index.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../app/utils/agentMessages.ts', import.meta.url), 'utf8')
  ])

  for (const domain of ['navigation', 'agent', 'audit', 'policies', 'learn']) {
    assert.match(english, new RegExp(`"${domain}"\\s*:`))
  }
  for (const view of [agent, audit, policies, learn, layout]) assert.match(view, /useI18n\(\)/)
  assert.match(agent, /TOOL_LABEL_KEYS/)
  assert.match(agent, /<Markdown[\s\S]*:value="part\.text"/)
  assert.doesNotMatch(helper, /Finding employee|Working…|Action failed|Awaiting approval/)

  assert.match(agent, /:description="(?:messageError|error)\.message"/)
  assert.match(policies, /const\s+{\s*t,\s*te\s*}\s*=\s*useI18n\(\)/)
  assert.match(policies, /function localizedPolicyTitle/)
  assert.match(policies, /function localizedPolicyDescription/)
  assert.match(policies, /function localizedRuleReason/)
  assert.match(policies, /te\(key\)\s*\?\s*t\(key\)\s*:\s*policy\.title/)
  assert.match(policies, /te\(key\)\s*\?\s*t\(key\)\s*:\s*policy\.description/)
  assert.match(policies, /te\(key\)\s*\?\s*t\(key\)\s*:\s*rule\.reason/)
  assert.doesNotMatch(policies, /{{ policy\.(?:title|description) }}|{{ rule\.reason }}/)
})
