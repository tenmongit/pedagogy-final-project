import { createContext, useContext } from 'react'
import { readLocal } from '@/lib/storage'
import { en } from './en'
import { kk } from './kk'
import { ru, type Messages } from './ru'

export type Locale = 'ru' | 'kk' | 'en'

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'kk', label: 'Қазақша', short: 'KZ' },
  { code: 'en', label: 'English', short: 'EN' },
]

export const DICTS: Record<Locale, Messages> = { ru, kk, en }

/** Локаль для Intl (даты и числа). */
export const INTL_LOCALE: Record<Locale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB' }

export const LOCALE_KEY = 'izden.locale'

export function detectLocale(): Locale {
  const saved = readLocal(LOCALE_KEY)
  if (saved === 'ru' || saved === 'kk' || saved === 'en') return saved
  const nav = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase()
  if (nav.startsWith('kk')) return 'kk'
  if (nav.startsWith('en')) return 'en'
  return 'ru'
}

// Текущий язык для кода вне React (ошибки API, ErrorBoundary). Обновляет I18nProvider.
let current: Locale = detectLocale()

export function setCurrentLocale(locale: Locale) {
  current = locale
}

export function getLocale(): Locale {
  return current
}

export function getMessages(): Messages {
  return DICTS[current]
}

export interface I18n {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
  formatDate: (iso: string) => string
  formatDateTime: (iso: string) => string
  formatNumber: (n: number) => string
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n вне I18nProvider')
  return ctx
}

/** Словарь текущего языка: t.assignments.title, t.work.versions(3). */
export function useT(): Messages {
  return useI18n().t
}
