import { createContext, useContext } from 'react'
import { readLocal } from '@/lib/storage'

/** Выбор пользователя. 'system' — следовать настройке ОС (по умолчанию). */
export type ThemePref = 'system' | 'light' | 'dark'
/** Что реально нарисовано сейчас. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'izden.theme'

export function readThemePref(): ThemePref {
  const saved = readLocal(THEME_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export interface ThemeState {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme вне ThemeProvider')
  return ctx
}
