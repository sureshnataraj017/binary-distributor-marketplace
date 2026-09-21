import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ALL_STATES } from '@/config/indiaStates'
import { AppRoutes } from '@/routes/AppRoutes'
import { useFilterStore } from '@/store/filterStore'
import { useNetworkStore } from '@/store/networkStore'
import { buildApp } from '../../server/app'
import { createStore } from '../../server/store'

/** Throwaway in-memory SQLite database, seeded fresh for the test run. */
export const store = createStore({ path: ':memory:' })
const api = buildApp({ store })

/**
 * Routes the browser's `fetch('/api/...')` into the REAL Fastify app, in-process (no network port).
 * The UI tests therefore exercise the whole stack: components, hooks, HTTP client, routes, domain logic.
 */
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.pathname + input.search
        : input.url
  const response = await api.inject({
    method: (init?.method ?? 'GET') as 'GET' | 'POST',
    url,
    headers: init?.headers as Record<string, string> | undefined,
    payload: init?.body as string | undefined,
  })
  return new Response(response.body, {
    status: response.statusCode,
    headers: { 'content-type': String(response.headers['content-type'] ?? 'application/json') },
  })
}

export function renderApp(path: string) {
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
