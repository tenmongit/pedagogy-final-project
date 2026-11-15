import { useParams } from 'react-router-dom'
import { errorMessage } from '@/api'
import { useWork } from '@/api/queries'
import { useUser } from '@/auth/context'
import { ErrorState, LoadingRows, PageBody, PageHeader, type Crumb } from '@/components/izden/PageHeader'
import { StatusDot } from '@/components/izden/marks'
import { StudentWorkView } from './StudentWorkView'
import { TeacherWorkView } from './TeacherWorkView'

/**
 * Маршрут /works/:workId. Грузит WorkDetail, рисует шапку и отдаёт работу нужной роли:
 * студенту — экран этапа, преподавателю — таймлайн. Права проверяет бэкенд (403).
 */
export function WorkPage() {
  const id = Number(useParams().workId)
  const user = useUser()
  const work = useWork(id)

  const crumbs: Crumb[] = [{ label: 'Задания', to: '/' }]
  if (work.data) {
    crumbs.push({ label: work.data.assignment.title, to: `/assignments/${work.data.assignment.id}` })
    if (user.role === 'teacher') crumbs.push({ label: work.data.student.name })
  }

  return (
    <>
      <PageHeader crumbs={crumbs} right={work.data && <StatusDot status={work.data.status} />} />
      {work.isPending && (
        <PageBody>
          <LoadingRows />
        </PageBody>
      )}
      {work.isError && (
        <PageBody>
          <ErrorState message={errorMessage(work.error)} onRetry={() => work.refetch()} />
        </PageBody>
      )}
      {work.data &&
        (user.role === 'teacher' ? <TeacherWorkView work={work.data} /> : <StudentWorkView work={work.data} />)}
    </>
  )
}
