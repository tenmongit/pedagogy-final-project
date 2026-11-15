import { useCallback, useEffect, useMemo, useState } from 'react'
import { writeLocal } from '@/lib/storage'
import { DICTS, I18nContext, INTL_LOCALE, LOCALE_KEY, detectLocale, setCurrentLocale, type I18n, type Locale } from './context'

const KK_MONTHS = ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел']

/** Язык интерфейса: RU / KZ / EN. Выбор запоминается в браузере, по умолчанию — язык браузера, иначе русский. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next)
    setLocaleState(next)
    writeLocal(LOCALE_KEY, next)
  }, [])

  useEffect(() => {
    setCurrentLocale(locale)
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18n>(() => {
    const intl = INTL_LOCALE[locale]
    const date = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' })
    const dateTime = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const time = new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', hour12: false })
    const number = new Intl.NumberFormat(intl)
    // «15 нояб.» → «15 нояб»: точка сокращения в плотном интерфейсе лишняя.
    const clean = (s: string) => s.replace(/\.(?=\s|,|$)/g, '')

    // В данных браузеров для kk нет коротких названий месяцев («M11»), поэтому казахские даты собираем сами.
    const kkDate = (d: Date) => `${d.getDate()} ${KK_MONTHS[d.getMonth()]}`
    const formatDate = (iso: string) => {
      const d = new Date(iso)
      return locale === 'kk' ? kkDate(d) : clean(date.format(d))
    }
    const formatDateTime = (iso: string) => {
      const d = new Date(iso)
      return locale === 'kk' ? `${kkDate(d)}, ${time.format(d)}` : clean(dateTime.format(d))
    }

    return {
      locale,
      setLocale,
      t: DICTS[locale],
      formatDate,
      formatDateTime,
      formatNumber: (n) => number.format(n),
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
