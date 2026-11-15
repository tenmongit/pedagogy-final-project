import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, type AIDeclaration, type WorkDetail } from '@/api'
import { useAdvanceWork, useSubmitVersion } from '@/api/queries'
import { LIMITS, STAGES } from '@/api/types'
import { useUser } from '@/auth/context'
import { PageTitle } from '@/components/izden/PageHeader'
import { StageStepper, StatusDot } from '@/components/izden/marks'
import { FeedbackItem, GradeCard, Properties } from '@/components/izden/work'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/context'
import { EMPTY_DECLARATION, normalizeDeclaration, validateVersion } from '@/lib/declaration'
import { hintsAfterLast } from '@/lib/hints'
import { useNewFeedbackIds } from '@/lib/seen'
import { draftKey, readLocal, writeLocal } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { DeclarationForm } from './student/DeclarationForm'
import { HintsPanel } from './student/HintsPanel'
import { StageHistory } from './student/StageHistory'

/**
 * Экран этапа у студента (раздел 4 спеки, макет «Студент · этап»).
 * key={stage}: после перехода на следующий этап состояние формы начинается заново.
 */
export function StudentWorkView({ work }: { work: WorkDetail }) {
  return <StageWorkspace key={work.current_stage} work={work} />
}

function StageWorkspace({ work }: { work: WorkDetail }) {
  const user = useUser()
  const { t, formatDate, formatDateTime, formatNumber } = useI18n()
  const stage = work.current_stage
  const stageLabel = t.labels.stage[stage]
  const stageIndex = STAGES.indexOf(stage)
  const versions = work.stages[stageIndex].submissions
  const last = versions.at(-1)
  const prevLast = stageIndex > 0 ? work.stages[stageIndex - 1].submissions.at(-1) : undefined
  const graded = work.status === 'graded'
  const hintsSince = hintsAfterLast(work.hints, stage, versions)

  // --- Текст: черновик живёт в браузере, иначе берём последнюю сданную версию.
  // Финал обычно дорабатывают из черновика, поэтому на пустом финале подставляем последний черновик.
  const key = draftKey(work.id, stage)
  const [text, setText] = useState(
    () => readLocal(key) ?? last?.text ?? (stage === 'final' ? (prevLast?.text ?? '') : ''),
  )
  const dirty = text !== (last?.text ?? '')
  const changeText = (value: string) => {
    setText(value)
    writeLocal(key, value)
  }

  // --- Декларация: если после прошлой версии были подсказки Izden, отмечаем их сразу (раздел 4).
  const [decl, setDecl] = useState<AIDeclaration>(() =>
    hintsSince.length > 0 ? { ...EMPTY_DECLARATION, used_ai: true, tools: ['izden_hints'] } : EMPTY_DECLARATION,
  )
  const [autoIzden, setAutoIzden] = useState(hintsSince.length > 0)
  const onHintAdded = () => {
    setDecl((d) => ({ ...d, used_ai: true, tools: d.tools.includes('izden_hints') ? d.tools : [...d.tools, 'izden_hints'] }))
    setAutoIzden(true)
  }

  // --- Сдача версии.
  const [showErrors, setShowErrors] = useState(false)
  const errors = validateVersion(text, decl, t)
  const hasErrors = Object.keys(errors).length > 0
  const submit = useSubmitVersion(work.id)
  const handleSubmit = () => {
    setShowErrors(true)
    if (hasErrors) return
    submit.mutate(
      { text, ai_declaration: normalizeDeclaration(decl) },
      {
        onSuccess: (s) => {
          toast.success(t.student.submitted(s.version))
          writeLocal(key, null)
          setDecl(EMPTY_DECLARATION)
          setAutoIzden(false)
          setShowErrors(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  // --- Переход на следующий этап (назад нельзя).
  const nextStage = STAGES[stageIndex + 1]
  const nextLabel = nextStage ? t.labels.stage[nextStage] : ''
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const advance = useAdvanceWork(work.id)
  const handleAdvance = () =>
    advance.mutate(undefined, {
      onSuccess: (w) => toast.success(t.student.advanced(t.labels.stage[w.current_stage])),
      onError: (err) => toast.error(errorMessage(err)),
    })

  // --- Фидбэк сверху: к последней версии этого этапа, а если версий ещё нет — к последней версии прошлого.
  const feedbackSource = last ?? prevLast
  const topFeedback = feedbackSource?.feedback ?? []
  const fresh = useNewFeedbackIds(user.id, topFeedback.map((f) => f.id))

  const nextVersion = versions.length + 1

  // Сетка: на десктопе две колонки (рабочая зона + история слева, свойства и подсказки справа).
  // На телефоне порядок: рабочая зона → подсказки → история, чтобы до подсказок не листать всю историю.
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 px-4 pt-6 pb-8 sm:px-8 sm:pt-8 lg:col-start-1 lg:row-start-1 lg:px-12">
        <div className="mx-auto flex max-w-[720px] flex-col gap-7">
          <StageStepper current={stage} />

          <div className="flex flex-col gap-1.5">
            <PageTitle>{stageLabel}</PageTitle>
            <p className="text-[13px] text-muted-foreground">
              {graded
                ? t.student.gradedClosed
                : versions.length === 0
                  ? t.student.firstNotSubmitted
                  : dirty
                    ? t.student.draftSaved(nextVersion)
                    : t.student.submittedAt(last!.version, formatDateTime(last!.created_at))}
            </p>
          </div>

          {work.grade && <GradeCard grade={work.grade} author={t.work.teacher} />}

          {work.status === 'awaiting_defense' && (
            <p className="rounded-lg border px-4 py-3 text-[13px]">
              <span className="font-medium">{t.student.awaitingDefense}</span>{' '}
              <span className="text-muted-foreground">{t.student.awaitingDefenseHint}</span>
            </p>
          )}

          {topFeedback.map((f) => (
            <FeedbackItem
              key={f.id}
              feedback={f}
              author={t.work.teacher}
              title={t.work.feedbackTo(
                feedbackSource!.version,
                feedbackSource!.stage !== stage ? t.labels.stage[feedbackSource!.stage] : undefined,
              )}
              isNew={fresh.has(f.id)}
            />
          ))}

          {!graded && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="stage-text" className="sr-only">
                  {t.student.textLabel(stageLabel)}
                </label>
                <textarea
                  id="stage-text"
                  rows={14}
                  value={text}
                  onChange={(e) => changeText(e.target.value)}
                  placeholder={t.student.placeholder[stage]}
                  aria-invalid={showErrors && errors.text ? true : undefined}
                  aria-describedby="stage-text-meta"
                  className="min-h-[280px] w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-base leading-[1.75] tracking-[-0.01em] outline-none focus-visible:ring-3 focus-visible:ring-ring/20 lg:rounded-none lg:border-0 lg:px-0 lg:focus-visible:ring-0"
                />
                <div
                  id="stage-text-meta"
                  className="flex flex-col gap-1 border-t pt-2.5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-3"
                >
                  <span>{t.student.piiNote}</span>
                  <span className={cn('shrink-0 tabular-nums', text.length > LIMITS.textMax && 'font-medium text-danger-ink')}>
                    {formatNumber(text.length)} / {formatNumber(LIMITS.textMax)}
                  </span>
                </div>
                {showErrors && errors.text && (
                  <span role="alert" className="text-xs text-danger-ink">
                    {errors.text}
                  </span>
                )}
              </div>

              <DeclarationForm
                value={decl}
                onChange={setDecl}
                autoIzden={autoIzden}
                hintsSince={hintsSince.length}
                errors={showErrors ? errors : {}}
              />

              <div className="flex flex-col gap-3 border-t pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button onClick={handleSubmit} disabled={submit.isPending} className="h-10 max-sm:w-full lg:h-[34px]">
                    {submit.isPending ? t.student.submitting : t.student.submit(nextVersion)}
                  </Button>
                  {nextStage && !confirmAdvance && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmAdvance(true)}
                      disabled={versions.length === 0}
                      className="h-10 max-sm:w-full lg:h-[34px]"
                    >
                      {t.student.advance(nextLabel)}
                    </Button>
                  )}
                  {showErrors && hasErrors && <span className="text-xs text-danger-ink">{t.student.fixErrors}</span>}
                </div>
                {nextStage && versions.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t.student.advanceAfterFirst}</p>
                )}
                {nextStage && confirmAdvance && (
                  <div role="alertdialog" aria-labelledby="advance-q" className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px]">
                    <p id="advance-q">
                      <span className="font-medium">{t.student.advanceQuestion(nextLabel)}</span>{' '}
                      <span className="text-muted-foreground">
                        {t.student.advanceNoBack}
                        {dirty && ` ${t.student.advanceDirty}`}
                      </span>
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={handleAdvance} disabled={advance.isPending} className="h-10 lg:h-8">
                        {advance.isPending ? t.student.advancing : t.student.advanceYes}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmAdvance(false)} className="h-10 lg:h-8">
                        {t.student.stay}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <aside
        aria-label={t.student.asideLabel}
        className="flex flex-col gap-6 border-y px-4 py-6 sm:px-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-y-0 lg:border-l lg:px-5 lg:py-5"
      >
        <Properties
          rows={[
            [t.work.prop.status, <StatusDot key="s" status={work.status} />],
            [t.work.prop.stage, t.work.stageOf(stageLabel, stageIndex + 1)],
            [t.work.prop.versionsOnStage, versions.length],
            [t.work.prop.deadline, work.assignment.deadline ? formatDate(work.assignment.deadline) : '—'],
            [t.work.prop.assignment, work.assignment.title],
          ]}
        />
        <HintsPanel work={work} stage={stage} text={text} readOnly={graded} onHintAdded={onHintAdded} />
      </aside>

      {/* В коде после подсказок, чтобы порядок для экранных читалок совпадал с телефонным. */}
      <div className="min-w-0 px-4 pt-6 pb-10 sm:px-8 lg:col-start-1 lg:row-start-2 lg:px-12 lg:pt-2">
        <div className="mx-auto max-w-[720px]">
          <StageHistory work={work} />
        </div>
      </div>
    </div>
  )
}
