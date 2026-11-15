import { Component, type ErrorInfo, type ReactNode } from 'react'
import { getMessages } from '@/i18n/context'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Если экран упал при рендере, показываем понятное сообщение вместо белой страницы.
 * Ошибки запросов сюда не попадают: их показывают сами экраны через ErrorState.
 * Классовый компонент не может использовать хуки, поэтому тексты берём через getMessages().
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const t = getMessages()
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-6 py-10 sm:px-12">
        <h1 className="text-xl font-semibold">{t.errors.boundaryTitle}</h1>
        <p className="max-w-prose text-[13px] text-muted-foreground">{t.errors.boundaryText}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground"
          >
            {t.errors.reload}
          </button>
          <a href="/" className="inline-flex h-9 items-center rounded-md border px-3 text-[13px] font-medium">
            {t.errors.toAssignments}
          </a>
        </div>
      </div>
    )
  }
}
