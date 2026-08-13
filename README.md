# OpsPilot

Consola interna de gestión de accesos (IAM) con un agente de IA. Un administrador consulta o cambia permisos de empleados sobre recursos de la empresa, por interfaz o en lenguaje natural.

El LLM propone. El backend decide.

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
| Auth | Better Auth + `@convex-dev/better-auth` |
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

### Auth en Convex

`SITE_URL` es el origen de **Nuxt**, no `*.convex.site`.

```bash
pnpm exec convex env set SITE_URL http://localhost:3000
pnpm exec convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
pnpm exec convex env set GROQ_API_KEY "…"
pnpm exec convex env set GOOGLE_GENERATIVE_AI_API_KEY "…"
```

`BETTER_AUTH_SECRET` necesita al menos 32 caracteres.

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

Auth necesita un host con Nitro. No despliegues esto como sitio estático (`nuxt generate`).

## Variables

| Dónde | Variable | Uso |
|-------|----------|-----|
| Nuxt | `NUXT_PUBLIC_CONVEX_URL` / `CONVEX_URL` | Deployment `.convex.cloud` |
| Nuxt | `NUXT_PUBLIC_CONVEX_SITE_URL` / `CONVEX_SITE_URL` | HTTP Actions `.convex.site` |
| Convex | `SITE_URL` | Origen exacto de la app (`http://localhost:3000`) |
| Convex | `BETTER_AUTH_SECRET` | Firma de sesión |
| Convex | `GROQ_API_KEY` | Modelo del agente |
| Convex | `GOOGLE_GENERATIVE_AI_API_KEY` | Embeddings RAG |

## Cómo está organizado

```text
app/          UI Nuxt (pages, layout, componentes)
convex/       Schema, auth, IAM, agente, RAG, HTTP
docs/         Guía de réplica desde cero
```

Páginas: Overview, Agent, Employees, Resources, Policies, Approvals, Audit, Auth.

## Flujo de un grant

```text
UI o chat
  → (agente) findEmployee / findResource / getEmployeeAccess / searchPolicies
  → permissions.grantAccess
       → ¿empleado activo?
       → evaluateGrantPolicy          # siempre, determinista
            no  → policy_denied + audit
            sí + sensitive → approval (el permiso NO cambia)
            sí + no sensitive → escribe permissions + audit
```

RAG puede aconsejar al modelo. Si el modelo se equivoca, el motor en `convex/accessPolicy.ts` sigue bloqueando.

