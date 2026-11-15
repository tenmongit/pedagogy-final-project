import type { WorkDetail } from '@/api'
import { AiDot } from '@/components/izden/marks'
import { useT } from '@/i18n/context'

/** «6 версий · 7 подсказок ИИ» под заголовком работы. */
export function WorkCounters({ work }: { work: WorkDetail }) {
  const t = useT()
  const versions = work.stages.reduce((n, s) => n + s.submissions.length, 0)
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {t.work.versions(versions)} ·
      <span className="inline-flex items-center gap-1.5">
        {work.hints.length > 0 && <AiDot />}
        {t.work.hints(work.hints.length)}
      </span>
    </p>
  )
}
