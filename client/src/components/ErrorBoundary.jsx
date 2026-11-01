import { Component } from 'react'

/**
 * Error boundary that catches render errors in its subtree and shows a
 * retry-able fallback instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props
      if (fallback) {
        return fallback({ error: this.state.error, reset: () => this.setState({ error: null }) })
      }
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-zinc-500">
          <p className="text-sm">Something went wrong</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-md px-3 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
