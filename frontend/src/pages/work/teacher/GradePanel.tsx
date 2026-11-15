import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, type WorkDetail } from '@/api'
import { useSetGrade } from '@/api/queries'
import { LIMITS } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'

/** Оценка 0–100 и комментарий. Ставит только преподаватель и только после финала (раздел 6 спеки). */
export function GradePanel({ work }: { work: WorkDetail }) {
  const { t, formatDateTime } = useI18n()
  const g = t.grade
  const canGrade = work.status !== 'in_progress'
  const [score, setScore] = useState(work.grade ? String(work.grade.score) : '')
  const [comment, setComment] = useState(work.grade?.comment ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const setGrade = useSetGrade(work.id)

  const value = Number(score)
  const scoreError =
    score.trim() === '' || !Number.isInteger(value) || value < LIMITS.scoreMin || value > LIMITS.scoreMax ? g.errScore : null

  const submit = () => {
    setShowErrors(true)
    if (scoreError) return
    setGrade.mutate(
      { score: value, comment: comment.trim() },
      {
        onSuccess: () => {
          setShowErrors(false)
          toast.success(g.saved)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <section aria-labelledby="grade-form-title" className="flex flex-col gap-3 border-t pt-5">
      <h2 id="grade-form-title" className="text-sm font-semibold">
        {g.title}
      </h2>

      {!canGrade && <p className="text-[13px] text-muted-foreground">{g.needFinal}</p>}
      {work.grade && (
        <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span aria-hidden className="size-[7px] rounded-full bg-success" />
          {g.current} <strong className="font-semibold">{work.grade.score} / 100</strong>
          <span className="text-muted-foreground">· {formatDateTime(work.grade.created_at)}</span>
        </p>
      )}

      {/* noValidate: вместо подсказок браузера показываем свою ошибку на языке интерфейса. */}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <fieldset disabled={!canGrade} className="flex flex-col gap-3 disabled:opacity-60">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor="grade-score" className="w-[102px] text-[13px] text-muted-foreground">
                {g.score}
              </label>
              <input
                id="grade-score"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                aria-invalid={showErrors && scoreError ? true : undefined}
                aria-describedby={showErrors && scoreError ? 'grade-score-error' : undefined}
                placeholder="0"
                className={cn(
                  'h-10 w-20 rounded-md border bg-background px-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:h-8 sm:text-[13px]',
                  showErrors && scoreError ? 'border-destructive' : 'border-input',
                )}
              />
              <span className="text-[13px] text-muted-foreground">{g.of100}</span>
            </div>
            {showErrors && scoreError && (
              <span id="grade-score-error" role="alert" className="text-xs text-danger-ink">
                {scoreError}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grade-comment" className="text-[13px] text-muted-foreground">
              {g.comment}
            </label>
            <textarea
              id="grade-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-y rounded-md border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-[13px]"
            />
          </div>
          <Button type="submit" disabled={setGrade.isPending} className="h-10 self-start lg:h-[34px]">
            {setGrade.isPending ? t.common.saving : work.grade ? g.change : g.submit}
          </Button>
        </fieldset>
      </form>
      <p className="text-xs text-muted-foreground">{g.note}</p>
    </section>
  )
}
