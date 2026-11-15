/** Общие куски экрана работы: декларация, фидбэк, оценка, свойства. Используют и студент, и преподаватель. */
import type { AIDeclaration, AITool, Feedback, Grade } from '@/api'
import { useI18n, useT } from '@/i18n/context'
import { cn } from '@/lib/utils'
import { AiDot, Avatar } from './marks'

export function Tag({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-[4px] bg-secondary px-[7px] text-[13px]">
      {ai && <AiDot />}
      {children}
    </span>
  )
}

/** Любой инструмент ИИ помечен фиолетовой точкой: и подсказки Izden, и внешние. */
export function ToolTag({ tool }: { tool: AITool }) {
  const t = useT()
  return <Tag ai>{t.labels.tool[tool]}</Tag>
}

/** Декларация «Как я использовал ИИ» в виде строк свойств. Без вердиктов, только факты. */
export function DeclarationSummary({ decl, hintsCount }: { decl: AIDeclaration; hintsCount?: number }) {
  const t = useT()
  return (
    <dl className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] items-start gap-x-2 gap-y-2 text-[13px]">
      {decl.used_ai ? (
        <>
          <dt className="pt-0.5 text-muted-foreground">{t.work.decl.tools}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {decl.tools.map((tool) => (
              <ToolTag key={tool} tool={tool} />
            ))}
          </dd>
          {decl.purpose.length > 0 && (
            <>
              <dt className="pt-0.5 text-muted-foreground">{t.work.decl.purpose}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {decl.purpose.map((p) => (
                  <Tag key={p}>{t.labels.purpose[p]}</Tag>
                ))}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{t.work.decl.ownWords}</dt>
          <dd className="whitespace-pre-wrap">{decl.description}</dd>
        </>
      ) : (
        <>
          <dt className="text-muted-foreground">{t.work.decl.usage}</dt>
          <dd>{t.work.decl.notUsed}</dd>
        </>
      )}
      {hintsCount !== undefined && (
        <>
          <dt className="text-muted-foreground">{t.work.decl.hintsForVersion}</dt>
          <dd className="flex items-center gap-1.5">
            {hintsCount > 0 && <AiDot />}
            {hintsCount}
          </dd>
        </>
      )}
    </dl>
  )
}

/** Голос преподавателя: светлый кобальтовый блок. */
export function FeedbackItem(props: {
  feedback: Feedback
  author: string
  title?: string
  isNew?: boolean
  className?: string
}) {
  const { feedback, author, title, isNew, className } = props
  const { t, formatDateTime } = useI18n()
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-teacher-border bg-teacher-soft px-4 py-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={author} className="size-5 bg-teacher-border text-[10px]" />
        {title && <span className="text-[13px] font-semibold">{title}</span>}
        <span className="text-xs text-fg-subtle">
          {author} · {formatDateTime(feedback.created_at)}
        </span>
        {isNew && (
          <span className="ml-auto inline-flex h-5 items-center rounded-[4px] bg-primary px-[7px] text-[11px] font-semibold text-primary-foreground">
            {t.work.newBadge}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.text}</p>
    </div>
  )
}

/** Итог: оценка ставится только преподавателем (раздел 1 спеки). */
export function GradeCard({ grade, author }: { grade: Grade; author: string }) {
  const { t, formatDate } = useI18n()
  return (
    <section aria-labelledby="grade-title" className="flex flex-col gap-2.5 rounded-xl border border-success-border bg-success-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="grade-title" className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <span aria-hidden className="size-[7px] rounded-full bg-success" />
          {t.work.graded(formatDate(grade.created_at))}
        </h2>
        <span className="text-xs text-fg-subtle">{t.work.submissionsClosed}</span>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-[-0.02em] text-success-ink">{grade.score}</span>
        <span className="text-sm text-fg-subtle">/ 100</span>
      </p>
      {grade.comment && <p className="whitespace-pre-wrap text-sm">{grade.comment}</p>}
      <span className="text-xs text-fg-subtle">
        {author} · {t.work.gradeNote}
      </span>
    </section>
  )
}

/** Список свойств справа, как в Linear: подпись слева, значение справа. */
export function Properties({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-2.5 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
