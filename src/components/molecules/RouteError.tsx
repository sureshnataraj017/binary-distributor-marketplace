import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/atoms/Card'

interface State {
  error: Error | null
}

/** Catches render-time crashes so one broken page never blanks the whole app. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Card className="mx-auto mt-10 max-w-md p-8 text-center" role="alert">
        <p className="text-lg font-semibold">Something broke on this page</p>
        <p className="mt-1 text-sm text-ink-2">{this.state.error.message}</p>
        <Link
          to="/dashboard"
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-block text-brand hover:underline"
        >
          Back to dashboard
        </Link>
      </Card>
    )
  }
}
