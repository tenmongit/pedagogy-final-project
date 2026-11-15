import type { WorkDetail } from '@/api'
import { PageBody, PageTitle } from '@/components/izden/PageHeader'
import { StageStepper } from '@/components/izden/marks'
import { STAGE_LABEL } from '@/lib/labels'
import { WorkCounters } from './WorkCounters'

/**
 * Экран этапа у студента (макет «Студент · этап», раздел 4 спеки).
 * Дальше: текст, подсказки ИИ, декларация, сдача версии, переход к следующему этапу.
 */
export function StudentWorkView({ work }: { work: WorkDetail }) {
  return (
    <PageBody>
      <div className="flex flex-col gap-7">
        <StageStepper current={work.current_stage} />
        <div className="flex flex-col gap-1.5">
          <PageTitle>{STAGE_LABEL[work.current_stage]}</PageTitle>
          <WorkCounters work={work} />
        </div>
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
          Здесь будет экран этапа: текст, подсказки ИИ, декларация и сдача версии.
        </p>
      </div>
    </PageBody>
  )
}
