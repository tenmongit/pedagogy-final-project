import { createContext, useContext } from 'react'
import type { User } from '@/api'

export interface AuthState {
  user: User | null
  /** true, пока проверяем сохранённый токен при загрузке. */
  loading: boolean
  login: (userId: number) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}

/** Для экранов внутри RequireAuth: пользователь точно есть. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser без входа')
  return user
}
