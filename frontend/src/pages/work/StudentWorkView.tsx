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
import { EMPTY_DECLARATION, normalizeDeclaration, validateVersion } from '@/lib/declaration'
import { hintsAfterLast } from '@/lib/hints'
import { STAGE_LABEL, formatDate, formatDateTime } from '@/lib/labels'
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
  const stage = work.current_stage
  const stageIndex = STAGES.indexOf(stage)
  const versions = work.stages[stageIndex].submissions
  const last = versions.at(-1)
  const graded = work.status === 'graded'
  const hintsSince = hintsAfterLast(work.hints, stage, versions)

  // --- Текст: черновик живёт в браузере, иначе берём последнюю сданную версию.
  // Финал обычно дорабатывают из черновика, поэтому на пустом финале подставляем последний черновик.
  const key = draftKey(work.id, stage)
  const prevLast = stageIndex > 0 ? work.stages[stageIndex - 1].submissions.at(-1) : undefined
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
  const errors = validateVersion(text, decl)
  const hasErrors = Object.keys(errors).length > 0
  const submit = useSubmitVersion(work.id)
  const handleSubmit = () => {
    setShowErrors(true)
    if (hasErrors) return
    submit.mutate(
      { text, ai_declaration: normalizeDeclaration(decl) },
      {
        onSuccess: (s) => {
          toast.success(`Версия ${s.version} сдана`)
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
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const advance = useAdvanceWork(work.id)
  const handleAdvance = () =>
    advance.mutate(undefined, {
      onSuccess: (w) => toast.success(`Открыт этап «${STAGE_LABEL[w.current_stage]}»`),
      onError: (err) => toast.error(errorMessage(err)),
    })

  // --- Фидбэк сверху: к последней версии этого этапа, а если версий ещё нет — к последней версии прошлого.
  const feedbackSource = last ?? prevLast
  const topFeedback = feedbackSource?.feedback ?? []
  const fresh = useNewFeedbackIds(user.id, topFeedback.map((f) => f.id))

  const textCount = text.length
  const nextVersion = versions.length + 1

  // Сетка: на десктопе две колонки (рабочая зона + история слева, свойства и подсказки справа).
  // На телефоне порядок: рабочая зона → подсказки → история, чтобы до подсказок не листать всю историю.
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 px-4 pt-6 pb-8 sm:px-8 sm:pt-8 lg:col-start-1 lg:row-start-1 lg:px-12">
        <div className="mx-auto flex max-w-[720px] flex-col gap-7">
          <StageStepper current={stage} />

          <div className="flex flex-col gap-1.5">
            <PageTitle>{STAGE_LABEL[stage]}</PageTitle>
            <p className="text-[13px] text-muted-foreground">
              {graded
                ? 'Работа оценена, сдача закрыта'
                : versions.length === 0
                  ? 'Версия 1 · ещё не сдана'
                  : dirty
                    ? `Версия ${nextVersion} · не сдана · черновик сохранён в браузере`
                    : `Сдана версия ${last!.version} · ${formatDateTime(last!.created_at)}`}
            </p>
          </div>

          {work.grade && <GradeCard grade={work.grade} author="Преподаватель" />}

          {work.status === 'awaiting_defense' && (
            <p className="rounded-lg border px-4 py-3 text-[13px]">
              <span className="font-medium">Финал сдан, работа ждёт устной защиты.</span>{' '}
              <span className="text-muted-foreground">До оценки можно сдать новую версию финала.</span>
            </p>
          )}

          {topFeedback.map((f) => (
            <FeedbackItem
              key={f.id}
              feedback={f}
              author="Преподаватель"
              title={`Фидбэк к версии ${feedbackSource!.version}${feedbackSource!.stage !== stage ? ` · ${STAGE_LABEL[feedbackSource!.stage]}` : ''}`}
              isNew={fresh.has(f.id)}
            />
          ))}

          {!graded && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="stage-text" className="sr-only">
                  Текст этапа «{STAGE_LABEL[stage]}»
                </label>
                <textarea
                  id="stage-text"
                  rows={14}
                  value={text}
                  onChange={(e) => changeText(e.target.value)}
                  placeholder={PLACEHOLDER[stage]}
                  aria-invalid={showErrors && errors.text ? true : undefined}
                  aria-describedby="stage-text-meta"
                  className="min-h-[280px] w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-base leading-[1.75] tracking-[-0.01em] outline-none focus-visible:ring-3 focus-visible:ring-ring/20 lg:rounded-none lg:border-0 lg:px-0 lg:focus-visible:ring-0"
                />
                <div
                  id="stage-text-meta"
                  className="flex flex-col gap-1 border-t pt-2.5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:gap-3"
                >
                  <span>Текст уходит во внешний ИИ-сервис, когда вы просите подсказку. Не пишите ФИО и личные данные.</span>
                  <span className={cn('shrink-0 tabular-nums', textCount > LIMITS.textMax && 'font-medium text-danger-ink')}>
                    {textCount.toLocaleString('ru')} / {LIMITS.textMax.toLocaleString('ru')}
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
                    {submit.isPending ? 'Сдаём…' : `Сдать версию ${nextVersion}`}
                  </Button>
                  {nextStage && !confirmAdvance && (
                    <Button
                      variant="outline"
                      onClick={() => setConfirmAdvance(true)}
                      disabled={versions.length === 0}
                      className="h-10 max-sm:w-full lg:h-[34px]"
                    >
                      Перейти к этапу «{STAGE_LABEL[nextStage]}»
                    </Button>
                  )}
                  {showErrors && hasErrors && (
                    <span className="text-xs text-danger-ink">Исправьте ошибки выше, чтобы сдать версию.</span>
                  )}
                </div>
                {nextStage && versions.length === 0 && (
                  <p className="text-xs text-muted-foreground">Перейти дальше можно после первой сданной версии.</p>
                )}
                {nextStage && confirmAdvance && (
                  <div role="alertdialog" aria-labelledby="advance-q" className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-[13px]">
                    <p id="advance-q">
                      <span className="font-medium">Перейти к этапу «{STAGE_LABEL[nextStage]}»?</span>{' '}
                      <span className="text-muted-foreground">
                        Вернуться назад будет нельзя.
                        {dirty && ' Несданный текст этого этапа останется только в черновике.'}
                      </span>
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={handleAdvance} disabled={advance.isPending} className="h-10 lg:h-8">
                        {advance.isPending ? 'Переходим…' : 'Да, перейти'}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmAdvance(false)} className="h-10 lg:h-8">
                        Остаться
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
        aria-label="Свойства и подсказки"
        className="flex flex-col gap-6 border-y px-4 py-6 sm:px-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-y-0 lg:border-l lg:px-5 lg:py-5"
      >
        <Properties
          rows={[
            ['Статус', <StatusDot key="s" status={work.status} />],
            ['Этап', `${STAGE_LABEL[stage]} · ${stageIndex + 1} из 4`],
            ['Версий на этапе', versions.length],
            ['Дедлайн', work.assignment.deadline ? formatDate(work.assignment.deadline) : '—'],
            ['Задание', work.assignment.title],
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

const PLACEHOLDER: Record<WorkDetail['current_stage'], string> = {
  topic: 'Сформулируйте тему: что именно, для кого и на каком материале вы хотите исследовать.',
  plan: 'Набросайте план: части работы и что доказывает каждая.',
  draft: 'Пишите черновик. ИИ может подсказать слабые места, но текст пишете вы.',
  final: 'Финальная версия: проверьте структуру, ссылки и то, что вывод отвечает на вопрос.',
}
