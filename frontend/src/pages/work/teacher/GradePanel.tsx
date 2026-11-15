import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, type WorkDetail } from '@/api'
import { useSetGrade } from '@/api/queries'
import { LIMITS } from '@/api/types'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/labels'
import { cn } from '@/lib/utils'

/** Оценка 0–100 и комментарий. Ставит только преподаватель и только после финала (раздел 6 спеки). */
export function GradePanel({ work }: { work: WorkDetail }) {
  const canGrade = work.status !== 'in_progress'
  const [score, setScore] = useState(work.grade ? String(work.grade.score) : '')
  const [comment, setComment] = useState(work.grade?.comment ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const setGrade = useSetGrade(work.id)

  const value = Number(score)
  const scoreError =
    score.trim() === '' || !Number.isInteger(value) || value < LIMITS.scoreMin || value > LIMITS.scoreMax
      ? 'Оценка — целое число от 0 до 100.'
      : null

  const submit = () => {
    setShowErrors(true)
    if (scoreError) return
    setGrade.mutate(
      { score: value, comment: comment.trim() },
      {
        onSuccess: () => {
          setShowErrors(false)
          toast.success('Оценка сохранена')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <section aria-labelledby="grade-form-title" className="flex flex-col gap-3 border-t pt-5">
      <h2 id="grade-form-title" className="text-sm font-semibold">
        Оценка
      </h2>

      {!canGrade && (
        <p className="text-[13px] text-muted-foreground">Оценку можно поставить после того, как студент сдаст финальную версию.</p>
      )}
      {work.grade && (
        <p className="flex items-center gap-1.5 text-[13px]">
          <span aria-hidden className="size-[7px] rounded-full bg-success" />
          Поставлена: <strong className="font-semibold">{work.grade.score} / 100</strong>
          <span className="text-muted-foreground">· {formatDateTime(work.grade.created_at)}</span>
        </p>
      )}

      {/* noValidate: вместо английских подсказок браузера показываем свою ошибку по-русски. */}
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
                Балл
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
                  'h-10 w-20 rounded-md border px-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:h-8 sm:text-[13px]',
                  showErrors && scoreError ? 'border-destructive' : 'border-input',
                )}
              />
              <span className="text-[13px] text-muted-foreground">/ 100</span>
            </div>
            {showErrors && scoreError && (
              <span id="grade-score-error" role="alert" className="text-xs text-danger-ink">
                {scoreError}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grade-comment" className="text-[13px] text-muted-foreground">
              Комментарий для студента
            </label>
            <textarea
              id="grade-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-y rounded-md border border-input px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-[13px]"
            />
          </div>
          <Button type="submit" disabled={setGrade.isPending} className="h-10 self-start lg:h-[34px]">
            {setGrade.isPending ? 'Сохраняем…' : work.grade ? 'Изменить оценку' : 'Поставить оценку'}
          </Button>
        </fieldset>
      </form>
      <p className="text-xs text-muted-foreground">Оценку ставите только вы, после устной защиты. ИИ работу не оценивает.</p>
    </section>
  )
}
