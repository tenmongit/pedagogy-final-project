import { useCallback, useEffect, useMemo, useState } from 'react'
import { writeLocal } from '@/lib/storage'
import { THEME_KEY, ThemeContext, readThemePref, systemTheme, type ResolvedTheme, type ThemePref, type ThemeState } from './context'

/**
 * Тема: системная (по умолчанию), светлая или тёмная.
 * Тёмная включается классом .dark на <html>; токены цвета для неё — в index.css.
 * Первичный класс ставит скрипт в index.html до загрузки React, чтобы не было вспышки светлой темы.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readThemePref)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)

  // Следим за сменой темы ОС, пока выбрана «Системная».
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = pref === 'system' ? system : pref

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    writeLocal(THEME_KEY, next)
  }, [])

  const value = useMemo<ThemeState>(() => ({ pref, resolved, setPref }), [pref, resolved, setPref])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
