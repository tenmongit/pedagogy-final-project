import { useEffect, useState } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/utils'

const PHASE_MS = 2600
const SLOW_AFTER_S = 12

/**
 * Ожидание ответа ИИ: искра, переливающийся текст этапа и строки-заготовки.
 * `phases` описывают то, что реально уходит в промпт, и сменяются по кругу.
 * Скринридер слышит одно статичное `label`, а не каждую смену этапа.
 */
export function AiThinking({
  label,
  phases,
  lines = [92, 78, 54],
  className,
}: {
  label: string
  phases: string[]
  /** Ширины строк-заготовок в процентах; [] — без заготовок. */
  lines?: number[]
  className?: string
}) {
  const t = useT()
  const [phase, setPhase] = useState(0)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Date.now() - started
      setPhase(Math.floor(elapsed / PHASE_MS) % phases.length)
      setSeconds(Math.floor(elapsed / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [phases.length])

  return (
    <div role="status" className={cn('flex flex-col gap-2.5', className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex items-center gap-2.5">
        <Sparkle />
        <span key={phase} className="ai-phase text-[13px] font-medium">
          <span className="ai-shimmer-text">{phases[phase]}…</span>
        </span>
      </div>
      {lines.length > 0 && (
        <div aria-hidden className="flex flex-col gap-2 pl-[26px]">
          {lines.map((w, i) => (
            <span key={i} className="ai-skeleton h-2.5 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}
      {seconds >= SLOW_AFTER_S && <p className="ai-phase pl-[26px] text-xs text-muted-foreground">{t.common.aiThinkingSlow}</p>}
    </div>
  )
}

/** Четырёхлучевая искра с мягким свечением: метка «ИИ думает». */
function Sparkle() {
  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <span className="ai-glow absolute inset-[-5px] rounded-full" />
      <svg viewBox="0 0 24 24" className="ai-sparkle relative size-4 text-ai" fill="currentColor">
        <path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5Z" />
      </svg>
    </span>
  )
}
