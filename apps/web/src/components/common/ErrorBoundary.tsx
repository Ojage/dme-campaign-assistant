import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  ErrorBoundaryFallback,
  type ErrorBoundaryFallbackProps,
} from '@/components/common/ErrorBoundaryFallback'

export interface ErrorBoundaryProps
  extends Pick<ErrorBoundaryFallbackProps, 'layout' | 'title' | 'description' | 'showDevDetails'> {
  children: ReactNode
  /** Runs after a "Try again" press, before the boundary re-renders its subtree. */
  onReset?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

/**
 * Class error boundary, written the way the React docs prescribe:
 * `getDerivedStateFromError` swaps the crashed subtree for a branded fallback,
 * `componentDidCatch` keeps the diagnosis (and the component stack) in the
 * console, and resetting the state puts the subtree back. It is a class because
 * only the class lifecycle sees render-time errors; render a boundary with a
 * different `key` to reset it from the outside, or press "Try again".
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { error: null, componentStack: null }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an unexpected error', { error, componentStack: info.componentStack })
    this.setState({ componentStack: info.componentStack ?? null })
  }

  private readonly handleReset = (): void => {
    this.props.onReset?.()
    this.setState({ error: null, componentStack: null })
  }

  public override render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onReset={this.handleReset}
          layout={this.props.layout}
          title={this.props.title}
          description={this.props.description}
          showDevDetails={this.props.showDevDetails}
        />
      )
    }
    return this.props.children
  }
}