import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, errorMessage, type Assignment } from '@/api'
import { Button } from '@/components/ui/button'

/** Для студента: «Начать» создаёт Work (POST /assignments/{id}/works), «Открыть» ведёт в неё. */
export function StartOrOpenWork({ assignment }: { assignment: Assignment }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const start = useMutation({
    mutationFn: () => api.startWork(assignment.id),
    onSuccess: (work) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      navigate(`/works/${work.id}`)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  // На тач-экранах кнопка 40px, на телефоне во всю ширину карточки.
  const touch = 'max-lg:h-10 max-sm:w-full'

  if (assignment.my_work_id != null) {
    return (
      <Button asChild variant="outline" className={touch}>
        <Link to={`/works/${assignment.my_work_id}`}>Открыть</Link>
      </Button>
    )
  }
  return (
    <Button onClick={() => start.mutate()} disabled={start.isPending} className={touch}>
      {start.isPending ? 'Создаём…' : 'Начать'}
    </Button>
  )
}
