import { Menu } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useOpenNav } from './nav-context'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Верхняя полоса 48px: хлебные крошки слева, статус или действия справа.
 * Уже 1024px слева появляется кнопка меню; на телефоне видна только последняя крошка.
 */
export function PageHeader({ crumbs, right }: { crumbs: Crumb[]; right?: React.ReactNode }) {
  const openNav = useOpenNav()
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-2 sm:px-5 lg:static">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={openNav}
          aria-label="Открыть меню"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <nav aria-label="Путь" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <Fragment key={`${c.label}-${i}`}>
                {i > 0 && (
                  <span aria-hidden className="max-sm:hidden">
                    /
                  </span>
                )}
                {c.to && !last ? (
                  <Link to={c.to} className="truncate hover:text-foreground max-sm:hidden">
                    {c.label}
                  </Link>
                ) : (
                  <span className={cn('truncate', last ? 'text-foreground' : 'max-sm:hidden')}>{c.label}</span>
                )}
              </Fragment>
            )
          })}
        </nav>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 pr-2 text-[13px] sm:pr-0">{right}</div>}
    </header>
  )
}

/** Центральная колонка контента, как в макете. Отступы сужаются на телефоне. */
export function PageBody({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className={wide ? 'mx-auto max-w-5xl' : 'mx-auto max-w-3xl'}>{children}</div>
    </div>
  )
}

/** Заголовок страницы: 24px на телефоне, 28px от 640px. */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{children}</h1>
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-[13px]">
      <span className="text-danger-ink">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-8 font-medium text-foreground underline underline-offset-2">
          Повторить
        </button>
      )}
    </div>
  )
}
