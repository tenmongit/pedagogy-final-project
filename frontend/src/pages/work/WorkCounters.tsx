import type { WorkDetail } from '@/api'
import { AiDot } from '@/components/izden/marks'
import { plural } from '@/lib/labels'

/** «6 версий · 7 подсказок ИИ» под заголовком работы. */
export function WorkCounters({ work }: { work: WorkDetail }) {
  const versions = work.stages.reduce((n, s) => n + s.submissions.length, 0)
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {plural(versions, 'версия', 'версии', 'версий')} ·
      <span className="inline-flex items-center gap-1.5">
        {work.hints.length > 0 && <AiDot />}
        {plural(work.hints.length, 'подсказка ИИ', 'подсказки ИИ', 'подсказок ИИ')}
      </span>
    </p>
  )
}
