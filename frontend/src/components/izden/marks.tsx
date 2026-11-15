import type { Stage, WorkStatus } from '@/api'
import { STAGES } from '@/api/types'
import { useT } from '@/i18n/context'
import { initials } from '@/lib/labels'
import { stageState, type StageState } from '@/lib/stages'
import { cn } from '@/lib/utils'

/** Логотип: кобальтовый квадрат «iz» + название. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold', className)}>
      <span className="flex size-5 items-center justify-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground">
        iz
      </span>
      Izden
    </span>
  )
}

const STATUS_DOT: Record<WorkStatus, string> = {
  in_progress: 'bg-primary',
  awaiting_defense: 'bg-defense',
  graded: 'bg-success',
}

export function StatusDot({ status, className }: { status: WorkStatus; className?: string }) {
  const t = useT()
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden className={cn('size-[7px] rounded-full', STATUS_DOT[status])} />
      {t.labels.status[status]}
    </span>
  )
}

/** Метка «ИИ» / «AI» / «ЖИ» для заголовков блоков, связанных с ИИ. */
export function AiMark() {
  const t = useT()
  return (
    <span className="inline-flex h-[18px] items-center rounded-[4px] border border-ai-border px-1.5 text-[11px] font-semibold text-ai">
      {t.common.ai}
    </span>
  )
}

/** Фиолетовая точка: любое использование ИИ (подсказки Izden и внешние инструменты). */
export function AiDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-1.5 shrink-0 rounded-full bg-ai', className)} />
}

/** Пометка раздела 8 спеки: функция работает не по-настоящему. */
export function DemoBadge({ children }: { children?: React.ReactNode }) {
  const t = useT()
  return (
    <span className="inline-flex min-h-[22px] items-center rounded-[4px] border border-input bg-demo px-2 py-0.5 text-xs font-medium text-demo-ink">
      {children ?? t.common.demoBadge}
    </span>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full bg-avatar text-[11px] font-semibold text-teacher-ink',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Иконка этапа: пройден (серая галочка), текущий (половина круга), впереди (пунктир). */
export function StageIcon({ state, className }: { state: StageState; className?: string }) {
  if (state === 'done') {
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={cn('size-3.5 text-stage-done', className)}>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M5 8.2 7 10l4-4.2" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (state === 'current') {
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={cn('size-3.5 text-primary', className)}>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 3.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn('size-3.5 text-stage-todo', className)}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2.2" />
    </svg>
  )
}

/** Лента этапов: Тема — План — Черновик — Финал. */
export function StageStepper({ current }: { current: Stage }) {
  const t = useT()
  return (
    // Телефон: 4 равные колонки без тире, чтобы лента не переносилась. От 640px — строка с тире.
    <ol aria-label={t.work.stagesAria} className="grid grid-cols-4 gap-1 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-1.5 sm:text-[13px]">
      {STAGES.map((stage, i) => {
        const state = stageState(stage, current)
        return (
          <li key={stage} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-dash max-sm:hidden">
                —
              </span>
            )}
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 max-sm:w-full max-sm:justify-center max-sm:px-1 sm:h-[26px]',
                state === 'current' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              <StageIcon state={state} />
              <span className="truncate">{t.labels.stage[stage]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
