import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll } from 'vitest'
import { ALL_STATES } from '@/config/indiaStates'
import { AppRoutes } from '@/routes/AppRoutes'
import { useFilterStore } from '@/store/filterStore'
import { useNetworkStore } from '@/store/networkStore'
import { buildApp } from '../../server/app'
import { createTestStore } from '../../server/testing'

/**
 * Two real PostgreSQL databases (each in its own throwaway schema):
 *  - `store`      pre-loaded with the generated demo network
 *  - `emptyStore` completely empty, like a fresh install
 */
const fixtures = await createTestStore({ fixtures: true })
const empty = await createTestStore()
export const store = fixtures.store
export const emptyStore = empty.store
afterAll(async () => {
  await Promise.all([fixtures.dispose(), empty.dispose()])
})

const apps = { fixtures: buildApp({ store }), empty: buildApp({ store: emptyStore }) }
let active: keyof typeof apps = 'fixtures'

/**
 * Routes the browser's `fetch('/api/...')` into the REAL Fastify app, in-process (no network port).
 * The UI tests therefore exercise the whole stack: components, hooks, HTTP client, routes, domain logic,
 * and PostgreSQL.
 */
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname + input.search
        : input.url
  const response = await apps[active].inject({
    method: (init?.method ?? 'GET') as 'GET' | 'POST' | 'PATCH',
    url,
    headers: init?.headers as Record<string, string> | undefined,
    payload: init?.body as string | undefined,
  })
  return new Response(response.body, {
    status: response.statusCode,
    headers: { 'content-type': String(response.headers['content-type'] ?? 'application/json') },
  })
}

export function renderApp(path: string, { onEmptyDatabase = false } = {}) {
  active = onEmptyDatabase ? 'empty' : 'fixtures'
  useFilterStore.setState({ selectedState: ALL_STATES })
  useNetworkStore.setState({ collapsedIds: new Set(), selectedId: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
