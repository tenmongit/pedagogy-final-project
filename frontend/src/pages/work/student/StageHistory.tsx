import { ChevronRight } from 'lucide-react'
import { STAGES } from '@/api/types'
import type { WorkDetail } from '@/api'
import { AiDot, StageIcon } from '@/components/izden/marks'
import { DeclarationSummary, FeedbackItem } from '@/components/izden/work'
import { useI18n } from '@/i18n/context'
import { hintsForVersion } from '@/lib/hints'
import { stageState } from '@/lib/stages'

/** Все сданные версии: текущий этап сверху, раньше пройденные ниже. Версии раскрываются по клику. */
export function StageHistory({ work }: { work: WorkDetail }) {
  const { t, formatDateTime } = useI18n()
  const order = [...STAGES].reverse()
  const stages = order
    .map((stage) => work.stages.find((s) => s.stage === stage)!)
    .filter((s) => s.submissions.length > 0)

  if (stages.length === 0) return null

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-4">
      <h2 id="history-title" className="text-sm font-semibold">
        {t.student.historyTitle}
      </h2>
      {stages.map(({ stage, submissions }) => (
        <div key={stage} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold">
            <StageIcon state={stageState(stage, work.current_stage)} />
            {t.labels.stage[stage]}
            <span className="font-normal text-muted-foreground">{t.work.versions(submissions.length)}</span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {[...submissions].reverse().map((s) => {
              const index = submissions.indexOf(s)
              const hints = hintsForVersion(work.hints, stage, submissions, index)
              return (
                <li key={s.id}>
                  <details className="group rounded-lg border">
                    <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2 text-[13px] [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                      <span className="font-medium">{t.work.version(s.version)}</span>
                      <span className="text-muted-foreground">· {formatDateTime(s.created_at)}</span>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        ·{' '}
                        {s.ai_declaration.used_ai ? (
                          <>
                            <AiDot />
                            {s.ai_declaration.tools.map((tool) => t.labels.tool[tool]).join(', ')}
                          </>
                        ) : (
                          t.work.decl.notUsedShort
                        )}
                      </span>
                      {s.feedback.length > 0 && (
                        <span className="text-teacher-ink">· {t.work.feedbackCount(s.feedback.length)}</span>
                      )}
                    </summary>
                    <div className="flex flex-col gap-3 border-t px-3.5 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.text}</p>
                      <DeclarationSummary decl={s.ai_declaration} hintsCount={hints.length} />
                      {s.feedback.map((f) => (
                        <FeedbackItem key={f.id} feedback={f} author={t.work.teacher} />
                      ))}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
