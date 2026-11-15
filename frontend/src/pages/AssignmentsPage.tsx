import { Link } from 'react-router-dom'
import { errorMessage, type Assignment } from '@/api'
import { useAssignments } from '@/api/queries'
import { useUser } from '@/auth/context'
import { ErrorState, LoadingRows, PageBody, PageHeader, PageTitle } from '@/components/izden/PageHeader'
import { StartOrOpenWork } from '@/components/izden/StartOrOpenWork'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/labels'

export function AssignmentsPage() {
  const user = useUser()
  const assignments = useAssignments()

  return (
    <>
      <PageHeader crumbs={[{ label: 'Задания' }]} />
      <PageBody>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <PageTitle>Задания</PageTitle>
            <p className="text-[13px] text-muted-foreground">
              {user.role === 'student'
                ? 'Тема → план → черновик → финал. ИИ подсказывает, но текст пишете вы.'
                : 'Ваши задания и работы студентов по ним.'}
            </p>
          </div>

          {assignments.isPending && <LoadingRows />}
          {assignments.isError && (
            <ErrorState message={errorMessage(assignments.error)} onRetry={() => assignments.refetch()} />
          )}
          {assignments.data?.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
              Заданий пока нет.
            </p>
          )}

          {assignments.data && assignments.data.length > 0 && (
            <ul className="flex flex-col gap-2">
              {assignments.data.map((a) => (
                <AssignmentRow key={a.id} assignment={a} role={user.role} />
              ))}
            </ul>
          )}
        </div>
      </PageBody>
    </>
  )
}

function AssignmentRow({ assignment: a, role }: { assignment: Assignment; role: 'student' | 'teacher' }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link to={`/assignments/${a.id}`} className="font-medium hover:underline">
          {a.title}
        </Link>
        {a.description && <p className="text-[13px] text-muted-foreground">{a.description}</p>}
        {a.deadline && <p className="text-xs text-muted-foreground">Дедлайн {formatDate(a.deadline)}</p>}
      </div>
      {role === 'student' ? (
        <StartOrOpenWork assignment={a} />
      ) : (
        <Button asChild variant="outline" className="max-lg:h-10 max-sm:w-full">
          <Link to={`/assignments/${a.id}`}>Работы студентов</Link>
        </Button>
      )}
    </li>
  )
}
