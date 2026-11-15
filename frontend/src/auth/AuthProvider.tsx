import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type User } from '@/api'
import { setUnauthorizedHandler } from '@/api/session'
import { tokenStore } from '@/api/token'
import { AuthContext, type AuthState } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // Восстанавливаем сессию по сохранённому токену.
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    api
      .me()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && tokenStore.clear())
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    async (userId: number) => {
      const res = await api.login(userId)
      tokenStore.set(res.token)
      queryClient.clear()
      setUser(res.user)
      return res.user
    },
    [queryClient],
  )

  const value = useMemo<AuthState>(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
