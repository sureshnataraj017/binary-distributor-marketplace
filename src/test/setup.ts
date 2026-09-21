import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Routes are lazy-loaded; the first import of a heavy chunk (React Flow, Recharts) can exceed the 1s default.
configure({ asyncUtilTimeout: 8000 })

// jsdom lacks these browser APIs, which React Flow relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

class DOMMatrixStub {
  m22 = 1
}
globalThis.DOMMatrixReadOnly ??= DOMMatrixStub as unknown as typeof DOMMatrixReadOnly
