import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { errorMessage } from '@/api'
import { useCreateAssignment } from '@/api/queries'
import { useUser } from '@/auth/context'
import { ErrorState, PageBody, PageHeader, PageTitle } from '@/components/izden/PageHeader'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/utils'

const TITLE_MAX = 300

/** Создание задания (сценарий преподавателя, шаг 1; POST /api/assignments). */
export function NewAssignmentPage() {
  const user = useUser()
  const navigate = useNavigate()
  const t = useT()
  const create = useCreateAssignment()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const crumbs = [{ label: t.nav.assignments, to: '/' }, { label: t.newAssignment.title }]
  const titleError = !title.trim()
    ? t.newAssignment.nameRequired
    : title.trim().length > TITLE_MAX
      ? t.newAssignment.nameTooLong(TITLE_MAX)
      : null

  if (user.role !== 'teacher') {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <PageBody>
          <ErrorState message={t.newAssignment.teachersOnly} />
        </PageBody>
      </>
    )
  }

  const submit = () => {
    setShowErrors(true)
    if (titleError) return
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        // datetime-local отдаёт местное время без зоны; в API уходит ISO 8601 в UTC (раздел 5 спеки).
        deadline: deadline ? new Date(deadline).toISOString() : null,
      },
      {
        onSuccess: (a) => {
          toast.success(t.newAssignment.created)
          navigate(`/assignments/${a.id}`)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  return (
    <>
      <PageHeader crumbs={crumbs} />
      <PageBody>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <PageTitle>{t.newAssignment.title}</PageTitle>
            <p className="text-[13px] text-muted-foreground">{t.newAssignment.subtitle}</p>
          </div>

          <Field id="a-title" label={t.newAssignment.name} error={showErrors ? titleError : null}>
            <input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.newAssignment.namePlaceholder}
              aria-invalid={showErrors && titleError ? true : undefined}
              aria-describedby={showErrors && titleError ? 'a-title-error' : undefined}
              className={cn(inputClass, 'h-10', showErrors && titleError && 'border-destructive')}
            />
          </Field>

          <Field id="a-description" label={t.newAssignment.description} hint={t.newAssignment.descriptionHint}>
            <textarea
              id="a-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClass, 'resize-y py-2')}
            />
          </Field>

          <Field id="a-deadline" label={t.newAssignment.deadline} hint={t.newAssignment.deadlineHint}>
            <input
              id="a-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(inputClass, 'h-10 w-full sm:w-64')}
            />
          </Field>

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Button type="submit" disabled={create.isPending} className="h-10 lg:h-[34px]">
              {create.isPending ? t.newAssignment.creating : t.newAssignment.create}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/')} className="h-10 lg:h-[34px]">
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  )
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-sm'

function Field(props: { id: string; label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-[13px] font-medium">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <span id={`${props.id}-error`} role="alert" className="text-xs text-danger-ink">
          {props.error}
        </span>
      ) : (
        props.hint && <span className="text-xs text-muted-foreground">{props.hint}</span>
      )}
    </div>
  )
}
