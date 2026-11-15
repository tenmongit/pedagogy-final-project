import type { WorkDetail } from '@/api'
import { PageBody, PageTitle } from '@/components/izden/PageHeader'
import { StageStepper } from '@/components/izden/marks'
import { WorkCounters } from './WorkCounters'

/**
 * Таймлайн работы у преподавателя (макет «Преподаватель · таймлайн», раздел 4 спеки).
 * Дальше: версии по этапам, декларации, подсказки, фидбэк, вопросы для защиты, оценка.
 */
export function TeacherWorkView({ work }: { work: WorkDetail }) {
  return (
    <PageBody>
      <div className="flex flex-col gap-7">
        <StageStepper current={work.current_stage} />
        <div className="flex flex-col gap-1.5">
          <PageTitle>{work.student.name}</PageTitle>
          <WorkCounters work={work} />
        </div>
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
          Здесь будет таймлайн работы: версии, декларации, подсказки, фидбэк, вопросы для защиты и оценка.
        </p>
      </div>
    </PageBody>
  )
}
