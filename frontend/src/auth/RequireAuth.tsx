import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context'

export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
