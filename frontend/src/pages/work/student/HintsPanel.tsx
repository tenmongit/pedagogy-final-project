import { useState } from 'react'
import { AI_IS_DEMO, ApiError, errorMessage, type Stage, type WorkDetail } from '@/api'
import { useRequestHint } from '@/api/queries'
import { LIMITS } from '@/api/types'
import { AiMark, DemoBadge } from '@/components/izden/marks'
import { useI18n, useT } from '@/i18n/context'
import { newestFirst } from '@/lib/hints'
import { cn } from '@/lib/utils'

interface Props {
  work: WorkDetail
  stage: Stage
  /** Текущий текст из поля: уходит в запрос как current_text. */
  text: string
  readOnly: boolean
  onHintAdded: () => void
}

/** Подсказки ИИ на этапе (POST /works/{id}/ai/hint). Лимит 10 на этап, каждый запрос виден преподавателю. */
export function HintsPanel({ work, stage, text, readOnly, onHintAdded }: Props) {
  const { t, formatDateTime } = useI18n()
  const [question, setQuestion] = useState('')
  const hint = useRequestHint(work.id)

  const stageHints = newestFirst(work.hints.filter((h) => h.stage === stage))
  const used = stageHints.length
  const left = LIMITS.hintsPerStage - used
  const exhausted = left <= 0
  const tooLong = question.length > LIMITS.questionMax
  const aiDown = hint.error instanceof ApiError && hint.error.code === 'AI_UNAVAILABLE'

  const ask = (q: string) =>
    hint.mutate(
      { question: q, current_text: text },
      {
        onSuccess: () => {
          setQuestion('')
          onHintAdded()
        },
      },
    )

  return (
    <section aria-labelledby="hints-title" className="flex flex-col gap-3 rounded-[10px] border border-ai-border bg-ai-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="hints-title" className="flex items-center gap-2 text-sm font-semibold">
          <AiMark />
          {t.hints.title}
        </h2>
        <Counter used={used} left={left} />
      </div>
      {AI_IS_DEMO && (
        <div>
          <DemoBadge />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t.hints.intro}</p>

      {!readOnly && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim() && !tooLong && !exhausted) ask(question.trim())
          }}
        >
          <label htmlFor="hint-question" className="sr-only">
            {t.hints.questionLabel}
          </label>
          <textarea
            id="hint-question"
            rows={2}
            value={question}
            disabled={exhausted}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.hints.placeholder}
            className="w-full resize-y rounded-md border border-ai-border bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ai/25 disabled:opacity-60 sm:text-[13px]"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-xs', tooLong ? 'text-danger-ink' : 'text-muted-foreground')}>
              {question.length > LIMITS.questionMax - 100 && `${question.length} / ${LIMITS.questionMax}`}
            </span>
            <button
              type="submit"
              disabled={!question.trim() || tooLong || exhausted || hint.isPending}
              className="h-10 rounded-md bg-ai-solid px-3.5 text-[13px] font-medium text-white disabled:bg-disabled disabled:text-muted-foreground lg:h-8"
            >
              {hint.isPending ? t.hints.thinking : t.hints.ask}
            </button>
          </div>
        </form>
      )}

      {exhausted && !readOnly && (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
          {t.hints.exhausted}
        </p>
      )}

      {hint.isError && (
        <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[13px]">
          <span className="font-medium text-danger-ink">{errorMessage(hint.error)}</span>
          {aiDown && (
            <>
              <span className="text-fg-soft">{t.hints.aiDownDetail}</span>
              <button
                type="button"
                onClick={() => hint.variables && ask(hint.variables.question)}
                className="mt-1 h-9 self-end rounded-md border bg-background px-3 text-[13px] font-medium lg:h-8"
              >
                {t.common.retry}
              </button>
            </>
          )}
        </div>
      )}

      {stageHints.length === 0 ? (
        <p className="border-t border-ai-line pt-3 text-xs text-muted-foreground">{t.hints.empty}</p>
      ) : (
        <ol className="flex flex-col">
          {stageHints.map((h) => (
            <li key={h.id} className="flex flex-col gap-1.5 border-t border-ai-line py-3">
              <div className="flex justify-between gap-2 text-[13px]">
                <span className="font-medium">{h.student_question}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap rounded-md border border-ai-line bg-background px-3 py-2.5 text-[13px] text-fg-soft">
                {h.hint}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Counter({ used, left }: { used: number; left: number }) {
  const t = useT()
  const label = `${used} / ${LIMITS.hintsPerStage}`
  if (left <= 0) return <span className="text-xs font-medium text-danger-ink">{label}</span>
  if (left <= 2) {
    return (
      <span className="text-xs font-medium text-ai">
        {label} · {t.hints.left(left)}
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{label}</span>
}
