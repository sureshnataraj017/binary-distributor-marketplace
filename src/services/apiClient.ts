/**
 * The only place that knows about HTTP. Services call `apiGet` / `apiPost`; nothing else uses `fetch`.
 * Errors are normalised to `ApiError` so pages can branch on `status` (404 vs 5xx vs offline).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const BASE_URL = '/api'

/** Demo aid: `?simulateError` in the page URL makes the server answer 503, to show error states. */
const simulateErrorRequested = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('simulateError')

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (simulateErrorRequested()) headers['x-simulate-error'] = '1'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check that it is running and try again.', 0)
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }
  return (await response.json()) as T
}

export const apiGet = <T>(path: string) => request<T>('GET', path)
export const apiPost = <T>(path: string, body: unknown) => request<T>('POST', path, body)
