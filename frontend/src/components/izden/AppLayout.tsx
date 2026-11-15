import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, LayoutList, LogOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api, USE_MOCKS } from '@/api'
import { resetMockDb } from '@/api/mock'
import { useAuth, useUser } from '@/auth/context'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { ROLE_LABEL } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Avatar, DemoBadge, Logo } from './marks'
import { NavContext } from './nav-context'

/**
 * Каркас приложения.
 * От 1024px (lg): постоянная боковая панель 232px слева.
 * Уже 1024px (телефон, планшет): панель прячется, открывается кнопкой меню в шапке страницы.
 */
export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const nav = useMemo(() => ({ openNav: () => setNavOpen(true) }), [])

  return (
    <NavContext.Provider value={nav}>
      <div className="flex min-h-svh">
        <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <SidebarContent />
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-[280px] max-w-[85vw] gap-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Навигация</SheetTitle>
            <SidebarContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </NavContext.Provider>
  )
}

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    // На тач-экранах пункты выше (40px), на десктопе плотнее (30px), как в макете.
    'flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-foreground hover:bg-sidebar-accent lg:min-h-[30px]',
    isActive && 'bg-sidebar-accent',
  )

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser()
  const { logout } = useAuth()
  const queryClient = useQueryClient()
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: api.listAssignments })
  const myWorks = (assignments.data ?? []).filter((a) => a.my_work_id != null)

  return (
    <div className="flex h-full flex-col gap-[18px] overflow-y-auto px-2.5 py-3">
      <div className="px-2 py-1">
        <Logo />
      </div>

      <nav aria-label="Основная навигация" className="flex flex-col gap-px">
        <NavLink to="/" end className={navItem} onClick={onNavigate}>
          <LayoutList className="size-3.5 text-muted-foreground" aria-hidden />
          Задания
        </NavLink>
      </nav>

      {user.role === 'student' && myWorks.length > 0 && (
        <SidebarSection title="Мои работы">
          {myWorks.map((a) => (
            <NavLink key={a.id} to={`/works/${a.my_work_id}`} className={navItem} onClick={onNavigate}>
              <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{a.title}</span>
            </NavLink>
          ))}
        </SidebarSection>
      )}

      {user.role === 'teacher' && (assignments.data?.length ?? 0) > 0 && (
        <SidebarSection title="Мои задания">
          {assignments.data!.map((a) => (
            <NavLink key={a.id} to={`/assignments/${a.id}`} className={navItem} onClick={onNavigate}>
              <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{a.title}</span>
            </NavLink>
          ))}
        </SidebarSection>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {USE_MOCKS && (
          <div className="flex flex-wrap items-center gap-2 px-2">
            <DemoBadge>Мок-данные</DemoBadge>
            <button
              type="button"
              className="min-h-8 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => {
                resetMockDb()
                queryClient.invalidateQueries()
              }}
            >
              Сбросить
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar name={user.name} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
          </span>
          <button
            type="button"
            onClick={logout}
            aria-label="Выйти"
            title="Выйти"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:size-8"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  )
}
