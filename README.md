# Axalot

Consola interna de gestión de accesos (IAM) con un agente de IA. Un administrador consulta o cambia permisos de empleados sobre recursos de la empresa, por interfaz o en lenguaje natural.

El LLM propone. El backend decide.

## Sin autenticación (todavía)

Esta demo **no tiene login**. Todas las mutations corren como un único actor fijo (`demo-admin`, ver `convex/domain/identity.ts`) — no hay usuarios, sesiones ni permisos por rol. Cualquiera con la URL desplegada tiene control admin completo: puede conceder o revocar accesos reales, aprobar o rechazar solicitudes, activar/desactivar políticas y usar el agente para ejecutar cambios reales.

Vale para correrla en local o compartirla en corto con protección adicional (por ejemplo, Password Protection de Vercel). No la despliegues públicamente sin cerrar el acceso primero.

## Qué hace

- Inventario de **empleados** y **recursos** (aplicaciones, entornos, infraestructura)
- Permisos `read` / `write` / `admin`
- **Approvals humanas** para recursos sensibles (Production)
- Motor de políticas **determinista** en TypeScript (no en el prompt)
- RAG de políticas para orientar al agente (advisory)
- **Audit log** de grants, revokes, denegaciones y solicitudes
- Chat persistente que usa las mismas mutations que la UI

El agente nunca inventa IDs, nunca aprueba solicitudes y nunca salta la política del servidor.

## Stack

| Capa | Tecnología |
|------|------------|
| UI | Nuxt 4, Vue 3, Tailwind 4, `@nuxtjs/color-mode` |
| Chat | `@ai-sdk/vue`, `@comark/nuxt` |
| Backend | Convex (`queries`, `mutations`, `actions`, HTTP Actions) |
| Bridge | `better-convex-nuxt` |
| Agente | `@convex-dev/agent`, Groq `openai/gpt-oss-20b` |
| RAG | `@convex-dev/rag`, embeddings Gemini `gemini-embedding-001` |
| Validación | Zod 4 |

Tipografía: stack de sistema de Tailwind (`ui-sans-serif` / `system-ui`). IDs y slugs en `font-mono`. Paleta: **Zinc** como marca; emerald / amber / red / blue solo para estado; violet como acento puntual.

## Requisitos

- Node.js 22.12+, 24.11+ o 26+
- pnpm
- Cuenta en [Convex](https://www.convex.dev)
- Claves de Groq y Google AI (agente y RAG)

## Arranque local

```bash
pnpm install
```

Copia las variables a `.env.local` (no lo subas a git):

```bash
NUXT_PUBLIC_CONVEX_URL=https://YOUR.convex.cloud
NUXT_PUBLIC_CONVEX_SITE_URL=https://YOUR.convex.site
CONVEX_URL=https://YOUR.convex.cloud
CONVEX_SITE_URL=https://YOUR.convex.site
```

En dos terminales:

```bash
pnpm exec convex dev
pnpm dev
```

La app queda en `http://localhost:3000`.

### Variables de entorno en Convex

```bash
pnpm exec convex env set GROQ_API_KEY "…"
pnpm exec convex env set GOOGLE_GENERATIVE_AI_API_KEY "…"
```

Opcional: `GROQ_API_KEYS` (varias keys separadas por coma, idealmente de cuentas de Groq distintas) para que el agente rote a la siguiente si una se queda sin cupo diario. El cupo TPD es por organización, no por key — rotar keys de la misma cuenta no evita el rate limit.

```bash
pnpm exec convex env set GROQ_API_KEYS "key_cuenta_1,key_cuenta_2"
```

### Datos de ejemplo

```bash
pnpm exec convex run seed:seed
pnpm exec convex run policyRag:seed
```

## Scripts

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Nuxt en local con `.env.local` |
| `pnpm exec convex dev` | Backend Convex + codegen |
| `pnpm build` | Build de producción |
| `pnpm preview` | Sirve el build |

Necesita un host con Nitro (Node, Vercel, etc.). No lo despliegues como sitio estático (`nuxt generate`).

## Variables

| Dónde | Variable | Uso |
|-------|----------|-----|
| Nuxt | `NUXT_PUBLIC_CONVEX_URL` / `CONVEX_URL` | Deployment `.convex.cloud` |
| Nuxt | `NUXT_PUBLIC_CONVEX_SITE_URL` / `CONVEX_SITE_URL` | HTTP Actions `.convex.site` |
| Convex | `GROQ_API_KEY` | Modelo del agente |
| Convex | `GROQ_API_KEYS` (opcional) | Rotación de keys si una se queda sin cupo |
| Convex | `GOOGLE_GENERATIVE_AI_API_KEY` | Embeddings RAG |

## Cómo está organizado

```text
app/          UI Nuxt (pages, layout, componentes)
convex/       Schema, IAM, agente, RAG, HTTP
```

Páginas: Home, Overview, Employees, Agent, Resources, Permissions, Approvals, Policies, Audit Log, Learn.

## Flujo de un grant

```text
UI o chat
  → (agente) findEmployee / findResource / getEmployeeAccess / searchPolicies
  → permissions.setAccessLevel / setAccessLevelFromAgent
       → runSetAccessLevel
            → evaluateCurrentPolicies     # siempre, determinista (domain/policyEngine.ts)
                 deny  → access_policy_denied + audit
                 allow + recurso sensible → approval (el permiso NO cambia)
                 allow + recurso estándar → escribe permissions + audit
```

Aprobar/rechazar una `approval` pendiente solo se puede desde la página **Approvals** — el agente puede consultar su estado (`getApprovalStatus`) pero nunca decidirla.

RAG puede aconsejar al modelo. Si el modelo se equivoca, el motor en `convex/domain/policyEngine.ts` sigue bloqueando.

