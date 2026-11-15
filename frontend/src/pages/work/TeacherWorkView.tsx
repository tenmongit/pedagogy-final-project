import { STAGES } from '@/api/types'
import type { WorkDetail } from '@/api'
import { PageTitle } from '@/components/izden/PageHeader'
import { AiDot, StageIcon, StatusDot } from '@/components/izden/marks'
import { DeclarationSummary, Properties } from '@/components/izden/work'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { hintsAfterLast, hintsForVersion, newestFirst } from '@/lib/hints'
import { STAGE_LABEL, formatDateTime, plural } from '@/lib/labels'
import { stageState } from '@/lib/stages'
import { DefensePanel } from './teacher/DefensePanel'
import { GradePanel } from './teacher/GradePanel'
import { HintList, VersionCard } from './teacher/VersionCard'
import { WorkCounters } from './WorkCounters'

/**
 * Таймлайн работы у преподавателя (раздел 4 спеки, макет «Преподаватель · таймлайн»).
 * Слева версии по этапам, справа свойства, вопросы для защиты и оценка.
 */
export function TeacherWorkView({ work }: { work: WorkDetail }) {
  const versionsTotal = work.stages.reduce((n, s) => n + s.submissions.length, 0)
  const stageIndex = STAGES.indexOf(work.current_stage)

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 px-4 pt-6 pb-10 sm:px-8 sm:pt-8 lg:px-12">
        <div className="mx-auto flex max-w-[760px] flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <PageTitle>{work.student.name}</PageTitle>
            <WorkCounters work={work} />
          </div>

          <Tabs defaultValue="timeline" className="gap-5">
            <div className="overflow-x-auto border-b">
              <TabsList variant="line" className="h-10 gap-4 px-0">
                <TabsTrigger value="timeline" className="flex-none px-0 text-[13px]">
                  Таймлайн
                </TabsTrigger>
                <TabsTrigger value="final" className="flex-none px-0 text-[13px]">
                  Финальный текст
                </TabsTrigger>
                <TabsTrigger value="log" className="flex-none px-0 text-[13px]">
                  Лог ИИ · {work.hints.length}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="timeline">
              <Timeline work={work} />
            </TabsContent>
            <TabsContent value="final">
              <FinalText work={work} />
            </TabsContent>
            <TabsContent value="log">
              <HintLog work={work} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <aside
        aria-label="Свойства, вопросы для защиты и оценка"
        className="flex flex-col gap-6 border-t px-4 py-6 sm:px-8 lg:border-t-0 lg:border-l lg:px-5 lg:py-5"
      >
        <Properties
          rows={[
            ['Статус', <StatusDot key="s" status={work.status} />],
            ['Этап', `${STAGE_LABEL[work.current_stage]} · ${stageIndex + 1} из 4`],
            ['Версий', versionsTotal],
            [
              'Подсказок ИИ',
              <span key="h" className="inline-flex items-center gap-1.5">
                {work.hints.length > 0 && <AiDot />}
                {work.hints.length}
              </span>,
            ],
            ['Оценка', work.grade ? `${work.grade.score} / 100` : <span key="g" className="text-muted-foreground">Нет</span>],
          ]}
        />
        <DefensePanel work={work} />
        <GradePanel key={work.grade?.id ?? 'none'} work={work} />
      </aside>
    </div>
  )
}

/** Этапы сверху вниз от текущего к первому; в каждом версии от новой к старой. */
function Timeline({ work }: { work: WorkDetail }) {
  const stages = [...work.stages]
    .reverse()
    .filter((s) => s.submissions.length > 0 || s.stage === work.current_stage)

  return (
    <div className="flex flex-col gap-7">
      {stages.map(({ stage, submissions }) => {
        const afterLast = hintsAfterLast(work.hints, stage, submissions)
        const latestId = submissions.at(-1)?.id
        return (
          <section key={stage} aria-labelledby={`stage-${stage}`} className="flex flex-col gap-2.5">
            <h2 id={`stage-${stage}`} className="flex items-center gap-2 text-[13px] font-semibold">
              <StageIcon state={stageState(stage, work.current_stage)} />
              {STAGE_LABEL[stage]}
              <span className="font-normal text-muted-foreground">
                {submissions.length > 0 ? plural(submissions.length, 'версия', 'версии', 'версий') : 'версий пока нет'}
              </span>
            </h2>

            {afterLast.length > 0 && (
              <HintList
                hints={newestFirst(afterLast)}
                title={submissions.length > 0 ? 'Подсказки после последней версии' : 'Подсказки на этапе'}
              />
            )}

            {[...submissions].reverse().map((s) => (
              <VersionCard
                key={s.id}
                work={work}
                submission={s}
                hints={hintsForVersion(work.hints, stage, submissions, submissions.indexOf(s))}
                isLatestCurrent={s.id === latestId && stage === work.current_stage}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function FinalText({ work }: { work: WorkDetail }) {
  const finals = work.stages.find((s) => s.stage === 'final')!.submissions
  const last = finals.at(-1)
  if (!last) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">Финал ещё не сдан.</p>
  }
  return (
    <article className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Версия {last.version} · {formatDateTime(last.created_at)}
      </p>
      <div className="whitespace-pre-wrap text-base leading-[1.75]">{last.text}</div>
      <div className="border-t pt-4">
        <DeclarationSummary
          decl={last.ai_declaration}
          hintsCount={hintsForVersion(work.hints, 'final', finals, finals.length - 1).length}
        />
      </div>
    </article>
  )
}

function HintLog({ work }: { work: WorkDetail }) {
  if (work.hints.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">Студент не обращался к ИИ.</p>
  }
  return (
    <ol className="flex flex-col">
      {newestFirst(work.hints).map((h) => (
        <li key={h.id} className="flex flex-col gap-1.5 border-b py-3 text-[13px]">
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <AiDot />
            {STAGE_LABEL[h.stage]} · {formatDateTime(h.created_at)}
          </span>
          <span className="font-medium">{h.student_question}</span>
          <p className="whitespace-pre-wrap rounded-md border border-ai-line bg-ai-soft px-3 py-2 text-[#2B2B2B]">{h.hint}</p>
        </li>
      ))}
    </ol>
  )
}
