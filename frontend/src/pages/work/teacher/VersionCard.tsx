import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, type AIHintLog, type SubmissionWithFeedback, type WorkDetail } from '@/api'
import { useAddFeedback } from '@/api/queries'
import { useUser } from '@/auth/context'
import { AiDot } from '@/components/izden/marks'
import { DeclarationSummary, FeedbackItem } from '@/components/izden/work'
import { Button } from '@/components/ui/button'
import { TOOL_LABEL, formatDateTime, plural } from '@/lib/labels'
import { cn } from '@/lib/utils'

interface Props {
  work: WorkDetail
  submission: SubmissionWithFeedback
  /** Подсказки, привязанные к этой версии по правилу времени из спеки. */
  hints: AIHintLog[]
  /** Последняя версия текущего этапа: раскрыта, а без фидбэка помечена «Ждёт фидбэка». */
  isLatestCurrent: boolean
}

/** Версия в таймлайне преподавателя: текст, декларация ИИ, подсказки к версии, фидбэк. */
export function VersionCard({ work, submission: s, hints, isLatestCurrent }: Props) {
  const user = useUser()
  const defaultOpen = isLatestCurrent
  // Старые версии и прошлые этапы не помечаем: студент уже ушёл дальше, это был бы шум.
  const waiting = isLatestCurrent && s.feedback.length === 0
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-lg border">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2 text-[13px] [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        <span className="font-medium">Версия {s.version}</span>
        <span className="text-muted-foreground">· {formatDateTime(s.created_at)}</span>
        {waiting && (
          <span className="inline-flex h-5 items-center rounded-[4px] bg-[#EEF3FE] px-[7px] text-xs font-medium text-teacher-ink">
            Ждёт фидбэка
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-muted-foreground group-open:hidden">
          ·{' '}
          {s.ai_declaration.used_ai ? (
            <>
              <AiDot />
              {s.ai_declaration.tools.map((t) => TOOL_LABEL[t]).join(', ')}
            </>
          ) : (
            'ИИ не использовал'
          )}
          {hints.length > 0 && ` · ${plural(hints.length, 'подсказка', 'подсказки', 'подсказок')}`}
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t px-3.5 py-3.5">
        <VersionText text={s.text} />
        <DeclarationSummary decl={s.ai_declaration} hintsCount={hints.length} />
        {hints.length > 0 && <HintList hints={hints} title={`Подсказки ИИ к версии ${s.version}`} />}
      </div>

      {s.feedback.length > 0 && (
        <div className="flex flex-col gap-2 border-t px-3.5 py-3">
          {s.feedback.map((f) => (
            <FeedbackItem key={f.id} feedback={f} author={f.teacher_id === user.id ? 'Вы' : 'Преподаватель'} />
          ))}
        </div>
      )}

      <FeedbackComposer workId={work.id} submissionId={s.id} version={s.version} highlight={waiting} />
    </details>
  )
}

function VersionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 600
  return (
    <div className="flex flex-col items-start gap-1">
      <p className={cn('whitespace-pre-wrap text-sm leading-[1.7] text-[#2B2B2B]', long && !expanded && 'line-clamp-6')}>{text}</p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-h-8 text-[13px] text-teacher-ink hover:underline">
          {expanded ? 'Свернуть' : 'Показать полностью'}
        </button>
      )}
    </div>
  )
}

export function HintList({ hints, title }: { hints: AIHintLog[]; title: string }) {
  return (
    <details className="rounded-md border border-ai-line bg-ai-soft px-3">
      <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] font-medium">
        <AiDot />
        {title} ({hints.length})
      </summary>
      <ol className="flex flex-col pb-2">
        {hints.map((h) => (
          <li key={h.id} className="flex flex-col gap-1 border-t border-ai-line py-2.5 text-[13px]">
            <span className="font-medium">
              {h.student_question} <span className="font-normal text-muted-foreground">· {formatDateTime(h.created_at)}</span>
            </span>
            <p className="whitespace-pre-wrap text-[#3D3D3D]">{h.hint}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}

function FeedbackComposer(props: { workId: number; submissionId: number; version: number; highlight: boolean }) {
  const [text, setText] = useState('')
  const add = useAddFeedback(props.workId)
  const id = `feedback-${props.submissionId}`
  const send = () =>
    add.mutate(
      { submissionId: props.submissionId, text: text.trim() },
      {
        onSuccess: () => {
          setText('')
          toast.success(`Фидбэк к версии ${props.version} отправлен`)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  return (
    <form
      className={cn('flex flex-col gap-2 border-t px-3.5 py-3 sm:flex-row sm:items-start', props.highlight ? 'bg-teacher-soft/60' : 'bg-sidebar')}
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Фидбэк к версии {props.version}
      </label>
      <textarea
        id={id}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Фидбэк к версии ${props.version}…`}
        className="min-h-10 flex-1 resize-y rounded-md border border-input bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:min-h-8 sm:py-1.5 sm:text-[13px]"
      />
      <Button type="submit" variant="outline" disabled={!text.trim() || add.isPending} className="h-10 sm:h-8">
        {add.isPending ? 'Отправляем…' : 'Отправить'}
      </Button>
    </form>
  )
}
