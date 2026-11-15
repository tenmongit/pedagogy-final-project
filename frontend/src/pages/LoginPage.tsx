import { useMutation } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { errorMessage, type User } from '@/api'
import { useDemoUsers } from '@/api/queries'
import { useAuth } from '@/auth/context'
import { ErrorState, LoadingRows } from '@/components/izden/PageHeader'
import { Avatar, Logo } from '@/components/izden/marks'
import { LanguageSwitcher, ThemeSwitcher } from '@/components/izden/Preferences'
import { useT } from '@/i18n/context'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const t = useT()

  // После входа всегда на список заданий: возврат на прошлый адрес мог бы привести
  // другого демо-пользователя на чужую работу (403).
  const users = useDemoUsers()
  const signIn = useMutation({
    mutationFn: (u: User) => login(u.id),
    onSuccess: () => navigate('/', { replace: true }),
  })

  if (user) return <Navigate to="/" replace />

  const teachers = users.data?.filter((u) => u.role === 'teacher') ?? []
  const students = users.data?.filter((u) => u.role === 'student') ?? []

  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Logo className="text-base" />
            <div className="flex flex-wrap gap-2">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.login.title}</h1>
          <p className="text-[13px] text-muted-foreground">{t.login.subtitle}</p>
        </div>

        {users.isPending && <LoadingRows rows={4} />}
        {users.isError && <ErrorState message={errorMessage(users.error)} onRetry={() => users.refetch()} />}

        {users.data && (
          <div className="flex flex-col gap-4">
            <UserGroup title={t.login.teacher} users={teachers} pendingId={signIn.variables?.id} busy={signIn.isPending} onPick={(u) => signIn.mutate(u)} />
            <UserGroup title={t.login.students} users={students} pendingId={signIn.variables?.id} busy={signIn.isPending} onPick={(u) => signIn.mutate(u)} />
          </div>
        )}

        {signIn.isError && <ErrorState message={errorMessage(signIn.error)} />}
      </div>
    </main>
  )
}

function UserGroup(props: {
  title: string
  users: User[]
  busy: boolean
  pendingId?: number
  onPick: (u: User) => void
}) {
  const t = useT()
  if (props.users.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-xs font-medium text-muted-foreground">{props.title}</h2>
      <ul className="flex flex-col overflow-hidden rounded-lg border bg-background">
        {props.users.map((u) => (
          <li key={u.id} className="border-b last:border-b-0">
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.onPick(u)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
            >
              <Avatar name={u.name} className="size-7" />
              <span className="flex flex-1 flex-col leading-tight">
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">{t.labels.role[u.role]}</span>
              </span>
              <span className="text-xs text-muted-foreground">{props.pendingId === u.id && props.busy ? t.login.signingIn : ''}</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
