import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Если экран упал при рендере, показываем понятное сообщение вместо белой страницы.
 * Ошибки запросов сюда не попадают: их показывают сами экраны через ErrorState.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка рендера', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-6 py-10 sm:px-12">
        <h1 className="text-xl font-semibold">Что-то сломалось на этом экране</h1>
        <p className="max-w-prose text-[13px] text-muted-foreground">
          Данные не потеряны. Обновите страницу или вернитесь к списку заданий.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground"
          >
            Обновить страницу
          </button>
          <a href="/" className="inline-flex h-9 items-center rounded-md border px-3 text-[13px] font-medium">
            К заданиям
          </a>
        </div>
      </div>
    )
  }
}
