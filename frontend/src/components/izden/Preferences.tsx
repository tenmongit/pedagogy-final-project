import { LOCALES, useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'

/** Переключатель языка RU / KZ / EN: три радиокнопки в виде сегментов. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <fieldset className={cn('inline-flex w-fit rounded-[7px] bg-secondary p-0.5', className)}>
      <legend className="sr-only">{t.common.language}</legend>
      {LOCALES.map((l) => (
        <label
          key={l.code}
          title={l.label}
          className={cn(
            'flex h-8 min-w-10 cursor-pointer items-center justify-center rounded-[5px] px-2 text-xs has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 lg:h-7',
            locale === l.code ? 'bg-background font-semibold text-foreground shadow-[0_0_0_1px_var(--input)]' : 'text-muted-foreground hover:text-foreground',
          )}
        >
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
