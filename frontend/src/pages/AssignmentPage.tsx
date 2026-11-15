import { Link, useParams } from 'react-router-dom'
import { errorMessage, type Assignment } from '@/api'
import { useAssignment, useAssignments, useWorks } from '@/api/queries'
import { useUser } from '@/auth/context'
import { ErrorState, LoadingRows, PageBody, PageHeader, PageTitle } from '@/components/izden/PageHeader'
import { StartOrOpenWork } from '@/components/izden/StartOrOpenWork'
import { AiDot, StatusDot } from '@/components/izden/marks'
import { STAGE_LABEL, formatDate } from '@/lib/labels'

export function AssignmentPage() {
  const id = Number(useParams().assignmentId)
  const user = useUser()
  // У студента my_work_id приходит только в списке заданий, поэтому берём задание оттуда.
  const list = useAssignments(user.role === 'student')
  const single = useAssignment(id, user.role === 'teacher')
  const query = user.role === 'student' ? list : single
  const assignment = user.role === 'student' ? list.data?.find((a) => a.id === id) : single.data

  return (
    <>
      <PageHeader crumbs={[{ label: 'Задания', to: '/' }, { label: assignment?.title ?? '…' }]} />
      <PageBody wide={user.role === 'teacher'}>
        {query.isPending && <LoadingRows />}
        {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
        {query.isSuccess && !assignment && <ErrorState message="Задание не найдено" />}
        {assignment && (
          <div className="flex flex-col gap-6">
            <AssignmentHead assignment={assignment} />
            {user.role === 'student' ? (
              <div>
                <StartOrOpenWork assignment={assignment} />
              </div>
            ) : (
              <WorksTable assignmentId={assignment.id} />
            )}
          </div>
        )}
      </PageBody>
    </>
  )
}

function AssignmentHead({ assignment: a }: { assignment: Assignment }) {
  return (
    <div className="flex flex-col gap-1.5">
      <PageTitle>{a.title}</PageTitle>
      {a.description && <p className="text-muted-foreground">{a.description}</p>}
      {a.deadline && <p className="text-[13px] text-muted-foreground">Дедлайн {formatDate(a.deadline)}</p>}
    </div>
  )
}

/** Список работ для преподавателя: GET /api/assignments/{id}/works → WorkSummary[]. */
function WorksTable({ assignmentId }: { assignmentId: number }) {
  const works = useWorks(assignmentId)

  if (works.isPending) return <LoadingRows />
  if (works.isError) return <ErrorState message={errorMessage(works.error)} onRetry={() => works.refetch()} />
  if (works.data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
        Никто из студентов ещё не начал работу.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Работы студентов</h2>

      {/* Телефон: карточки вместо таблицы. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {works.data.map((w) => (
          <li key={w.id}>
            <Link to={`/works/${w.id}`} className="flex flex-col gap-2 rounded-lg border px-4 py-3 active:bg-muted">
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium">{w.student.name}</span>
                <StatusDot status={w.status} className="text-[13px]" />
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                <span>{STAGE_LABEL[w.current_stage]}</span>
                <span>Версий: {w.submissions_count}</span>
                <span className="inline-flex items-center gap-1.5">
                  {w.hints_count > 0 && <AiDot />}
                  Подсказок ИИ: {w.hints_count}
                </span>
                <span>Оценка: {w.score ?? '—'}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b bg-sidebar text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Студент</th>
              <th className="px-4 py-2 font-medium">Этап</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 text-right font-medium">Версий</th>
              <th className="px-4 py-2 text-right font-medium">Подсказок ИИ</th>
              <th className="px-4 py-2 text-right font-medium">Оценка</th>
            </tr>
          </thead>
          <tbody>
            {works.data.map((w) => (
              <tr key={w.id} className="border-b last:border-b-0 hover:bg-muted/60">
                <td className="px-4 py-2.5">
                  <Link to={`/works/${w.id}`} className="font-medium hover:underline">
                    {w.student.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{STAGE_LABEL[w.current_stage]}</td>
                <td className="px-4 py-2.5">
                  <StatusDot status={w.status} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.submissions_count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    {w.hints_count > 0 && <AiDot />}
                    {w.hints_count}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {w.score ?? <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
