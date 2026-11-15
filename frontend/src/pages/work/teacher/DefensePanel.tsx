import { Lock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AI_IS_DEMO, ApiError, errorMessage, type DefenseQuestion, type WorkDetail } from '@/api'
import { useDefenseQuestions, useGenerateDefenseQuestions, useUpdateDefenseQuestions } from '@/api/queries'
import { AiMark, DemoBadge } from '@/components/izden/marks'
import { LoadingRows } from '@/components/izden/PageHeader'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/context'

const MIN = 3
const MAX = 4

/**
 * Вопросы для устной защиты (раздел 7 спеки). Видит только преподаватель.
 * ИИ только предлагает вопросы; преподаватель их просматривает и может править.
 */
export function DefensePanel({ work }: { work: WorkDetail }) {
  const { t, formatDateTime } = useI18n()
  const d = t.defense
  const hasFinal = work.stages.find((s) => s.stage === 'final')!.submissions.length > 0
  const dq = useDefenseQuestions(work.id, hasFinal)
  const gen = useGenerateDefenseQuestions(work.id)
  const upd = useUpdateDefenseQuestions(work.id)
  const [draft, setDraft] = useState<DefenseQuestion[] | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const generate = () => {
    setConfirmRegen(false)
    gen.mutate(undefined, { onSuccess: () => toast.success(d.generated) })
  }

  const draftError =
    draft && (draft.length < MIN || draft.length > MAX) ? d.errCount : draft?.some((q) => !q.question.trim()) ? d.errEmpty : null

  const save = () => {
    setShowErrors(true)
    if (!draft || draftError) return
    upd.mutate(
      draft.map((q) => ({ question: q.question.trim(), why: q.why.trim() })),
      {
        onSuccess: () => {
          setDraft(null)
          setShowErrors(false)
          toast.success(d.saved)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const data = dq.data
  const genError =
    gen.error instanceof ApiError && gen.error.code === 'AI_UNAVAILABLE' ? d.aiDown : gen.error ? errorMessage(gen.error) : null

  return (
    <section aria-labelledby="dq-title" className="flex flex-col gap-3 rounded-[10px] border border-ai-border bg-ai-soft p-4">
      <h2 id="dq-title" className="flex items-center gap-2 text-sm font-semibold">
        <AiMark />
        {d.title}
      </h2>
      {AI_IS_DEMO && (
        <div>
          <DemoBadge />
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3 shrink-0" aria-hidden />
        <span>
          {d.onlyYou}
          {data && ` · ${d.generatedAt(formatDateTime(data.created_at), data.edited_by_teacher)}`}
        </span>
      </p>

      {!hasFinal && <p className="text-[13px] text-muted-foreground">{d.needFinal}</p>}

      {hasFinal && dq.isPending && <LoadingRows rows={1} />}
      {hasFinal && dq.isError && <p className="text-[13px] text-danger-ink">{errorMessage(dq.error)}</p>}

      {hasFinal && dq.isSuccess && !data && !draft && (
        <Button onClick={generate} disabled={gen.isPending} className="h-10 bg-ai-solid text-white hover:bg-ai-solid/90 lg:h-8">
          {gen.isPending ? d.generating : d.generate}
        </Button>
      )}

      {data && !draft && (
        <>
          <ol className="flex flex-col">
            {data.questions.map((q, i) => (
              <li key={i} className="flex gap-2.5 border-t border-ai-line py-2.5">
                <span className="w-4 shrink-0 text-[13px] text-muted-foreground">{i + 1}</span>
                <div className="flex flex-col gap-1 text-[13px]">
                  <p>{q.question}</p>
                  {q.why && <p className="text-xs text-muted-foreground">{d.why(q.why)}</p>}
                </div>
              </li>
            ))}
          </ol>
          {confirmRegen ? (
            <div role="alertdialog" aria-labelledby="regen-q" className="flex flex-col gap-2 rounded-md border bg-background p-3 text-[13px]">
              <p id="regen-q">{d.regenConfirm}</p>
              <div className="flex gap-2">
                <Button onClick={generate} className="h-10 lg:h-8">
                  {d.regenYes}
                </Button>
                <Button variant="outline" onClick={() => setConfirmRegen(false)} className="h-10 lg:h-8">
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setDraft(data.questions.map((q) => ({ ...q })))} className="h-10 lg:h-8">
                {d.edit}
              </Button>
              <Button
                variant="outline"
                onClick={() => (data.edited_by_teacher ? setConfirmRegen(true) : generate())}
                disabled={gen.isPending}
                className="h-10 border-ai-border text-ai hover:text-ai lg:h-8"
              >
                {gen.isPending ? d.generating : d.regenerate}
              </Button>
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="flex flex-col gap-3">
          {draft.map((q, i) => (
            <fieldset key={i} className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5">
              <legend className="sr-only">{d.questionN(i + 1)}</legend>
              <div className="flex items-center justify-between">
                <label htmlFor={`dq-q-${i}`} className="text-xs font-medium">
                  {d.questionN(i + 1)}
                </label>
                <button
                  type="button"
                  aria-label={d.removeQuestion(i + 1)}
                  disabled={draft.length <= MIN}
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
              </div>
              <textarea
                id={`dq-q-${i}`}
                rows={2}
                value={q.question}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                className="resize-y rounded-md border border-input bg-background px-2 py-1.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-[13px]"
              />
              <label htmlFor={`dq-w-${i}`} className="text-xs text-muted-foreground">
                {d.whyLabel}
              </label>
              <input
                id={`dq-w-${i}`}
                value={q.why}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)))}
                className="h-10 rounded-md border border-input bg-background px-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:h-8 sm:text-[13px]"
              />
            </fieldset>
          ))}
          <Button
            variant="outline"
            disabled={draft.length >= MAX}
            onClick={() => setDraft([...draft, { question: '', why: '' }])}
            className="h-10 self-start lg:h-8"
          >
            <Plus aria-hidden /> {d.addQuestion}
          </Button>
          {showErrors && draftError && (
            <p role="alert" className="text-xs text-danger-ink">
              {draftError}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={upd.isPending} className="h-10 lg:h-8">
              {upd.isPending ? t.common.saving : t.common.save}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null)
                setShowErrors(false)
              }}
              className="h-10 lg:h-8"
            >
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}

      {genError && (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
          {genError}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{d.note}</p>
    </section>
  )
}
