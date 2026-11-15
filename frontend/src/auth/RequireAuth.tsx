import { Navigate, Outlet } from 'react-router-dom'
import { useT } from '@/i18n/context'
import { useAuth } from './context'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const t = useT()
  if (loading) {
    return <div className="p-8 text-muted-foreground">{t.common.loading}</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
