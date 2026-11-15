import { Monitor, Moon, Sun } from 'lucide-react'
import { LOCALES, useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
import { useTheme, type ThemePref } from '@/theme/context'

const segment = (active: boolean) =>
  cn(
    'flex h-8 min-w-10 cursor-pointer items-center justify-center rounded-[5px] px-2 text-xs has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 lg:h-7',
    active ? 'bg-background font-semibold text-foreground shadow-[0_0_0_1px_var(--input)]' : 'text-muted-foreground hover:text-foreground',
  )

/** Переключатель языка RU / KZ / EN: три радиокнопки в виде сегментов. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <fieldset className={cn('inline-flex w-fit rounded-[7px] bg-secondary p-0.5', className)}>
      <legend className="sr-only">{t.common.language}</legend>
      {LOCALES.map((l) => (
        <label key={l.code} title={l.label} className={segment(locale === l.code)}>
          <input
            type="radio"
            name="locale"
            value={l.code}
            checked={locale === l.code}
            onChange={() => setLocale(l.code)}
            className="sr-only"
          />
          <span aria-hidden>{l.short}</span>
          <span className="sr-only">{l.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** Переключатель темы: системная (по умолчанию), светлая, тёмная. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { pref, setPref } = useTheme()
  const { t } = useI18n()
  const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
    { value: 'system', label: t.common.themeSystem, Icon: Monitor },
    { value: 'light', label: t.common.themeLight, Icon: Sun },
    { value: 'dark', label: t.common.themeDark, Icon: Moon },
  ]
  return (
    <fieldset className={cn('inline-flex w-fit rounded-[7px] bg-secondary p-0.5', className)}>
      <legend className="sr-only">{t.common.theme}</legend>
      {options.map(({ value, label, Icon }) => (
        <label key={value} title={label} className={segment(pref === value)}>
          <input
            type="radio"
            name="theme"
            value={value}
            checked={pref === value}
            onChange={() => setPref(value)}
            className="sr-only"
          />
          <Icon className="size-3.5" aria-hidden />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  )
}
