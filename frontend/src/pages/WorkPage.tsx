import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api, errorMessage } from '@/api'
import { useUser } from '@/auth/context'
import { ErrorState, LoadingRows, PageBody, PageHeader, PageTitle, type Crumb } from '@/components/izden/PageHeader'
import { AiDot, StageStepper, StatusDot } from '@/components/izden/marks'
import { STAGE_LABEL, plural } from '@/lib/labels'

/**
 * Каркас экрана работы. Следующий шаг: экран этапа у студента (текст, подсказки, декларация)
 * и таймлайн у преподавателя — по макету на холсте «Izden: ключевые экраны».
 */
export function WorkPage() {
  const id = Number(useParams().workId)
  const user = useUser()
  const work = useQuery({ queryKey: ['work', id], queryFn: () => api.getWork(id) })

  const crumbs: Crumb[] = [{ label: 'Задания', to: '/' }]
  if (work.data) {
    crumbs.push({ label: work.data.assignment.title, to: `/assignments/${work.data.assignment.id}` })
    if (user.role === 'teacher') crumbs.push({ label: work.data.student.name })
  }

  const versions = work.data?.stages.reduce((n, s) => n + s.submissions.length, 0) ?? 0

  return (
    <>
      <PageHeader crumbs={crumbs} right={work.data && <StatusDot status={work.data.status} />} />
      <PageBody>
        {work.isPending && <LoadingRows />}
        {work.isError && <ErrorState message={errorMessage(work.error)} onRetry={() => work.refetch()} />}
        {work.data && (
          <div className="flex flex-col gap-7">
            <StageStepper current={work.data.current_stage} />
            <div className="flex flex-col gap-1.5">
              <PageTitle>
                {user.role === 'teacher' ? work.data.student.name : STAGE_LABEL[work.data.current_stage]}
              </PageTitle>
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                {plural(versions, 'версия', 'версии', 'версий')} ·
                <span className="inline-flex items-center gap-1.5">
                  {work.data.hints.length > 0 && <AiDot />}
                  {plural(work.data.hints.length, 'подсказка ИИ', 'подсказки ИИ', 'подсказок ИИ')}
                </span>
              </p>
            </div>
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
              {user.role === 'student'
                ? 'Здесь будет экран этапа: текст, подсказки ИИ, декларация и сдача версии.'
                : 'Здесь будет таймлайн работы: версии, декларации, подсказки, фидбэк, вопросы для защиты и оценка.'}
            </p>
          </div>
        )}
      </PageBody>
    </>
  )
}
