import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { errorMessage, type Assignment } from '@/api'
import { useStartWork } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/context'

/** Для студента: «Начать» создаёт Work (POST /assignments/{id}/works), «Открыть» ведёт в неё. */
export function StartOrOpenWork({ assignment }: { assignment: Assignment }) {
  const navigate = useNavigate()
  const start = useStartWork()
  const t = useT()

  // На тач-экранах кнопка 40px, на телефоне во всю ширину карточки.
  const touch = 'max-lg:h-10 max-sm:w-full'

  if (assignment.my_work_id != null) {
    return (
      <Button asChild variant="outline" className={touch}>
        <Link to={`/works/${assignment.my_work_id}`}>{t.assignments.open}</Link>
      </Button>
    )
  }
  return (
    <Button
      className={touch}
      disabled={start.isPending}
      onClick={() =>
        start.mutate(assignment.id, {
          onSuccess: (work) => navigate(`/works/${work.id}`),
          onError: (err) => toast.error(errorMessage(err)),
        })
      }
    >
      {start.isPending ? t.assignments.starting : t.assignments.start}
    </Button>
  )
}
