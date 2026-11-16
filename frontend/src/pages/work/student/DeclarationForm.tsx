import { Check } from 'lucide-react'
import { useId } from 'react'
import type { AIDeclaration, AIPurpose, AITool } from '@/api'
import { AiDot } from '@/components/izden/marks'
import { useT } from '@/i18n/context'
import { ALL_PURPOSES, ALL_TOOLS, toggle, type VersionErrors } from '@/lib/declaration'
import { cn } from '@/lib/utils'

interface Props {
  value: AIDeclaration
  onChange: (next: AIDeclaration) => void
  /** «Подсказки Izden» отмечены автоматически, потому что после прошлой версии были подсказки. */
  autoIzden: boolean
  hintsSince: number
  errors: VersionErrors
}

/** Блок «Как я использовал ИИ» (AIDeclaration). Обязателен перед каждой сдачей. */
export function DeclarationForm({ value, onChange, autoIzden, hintsSince, errors }: Props) {
  const t = useT()
  const d = t.declaration
  return (
    <section aria-labelledby="decl-title" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
        <h2 id="decl-title" className="text-sm font-semibold">
          {d.title}
        </h2>
        <span className="text-xs text-muted-foreground">{d.required}</span>
      </div>

      <Row label={d.usedAi}>
        <fieldset className="inline-flex w-fit self-start rounded-[7px] bg-secondary p-0.5">
          <legend className="sr-only">{d.usedAiLegend}</legend>
          <Segment value="no" checked={!value.used_ai} onSelect={() => onChange({ ...value, used_ai: false })}>
            {d.no}
          </Segment>
          <Segment value="yes" checked={value.used_ai} onSelect={() => onChange({ ...value, used_ai: true })}>
            {d.yes}
          </Segment>
        </fieldset>
      </Row>

      {value.used_ai && (
        <>
          <Row label={d.tools} error={errors.tools}>
            <ChipGroup legend={d.toolsLegend}>
              {ALL_TOOLS.map((tool) => (
                <Chip
                  key={tool}
                  checked={value.tools.includes(tool)}
                  onToggle={() => onChange({ ...value, tools: toggle<AITool>(value.tools, tool) })}
                  ai
                >
                  {t.labels.tool[tool]}
                  {tool === 'izden_hints' && autoIzden && value.tools.includes(tool) && (
                    <span className="font-normal text-muted-foreground">· {d.auto}</span>
                  )}
                </Chip>
              ))}
            </ChipGroup>
          </Row>

          <Row label={d.purpose}>
            <ChipGroup legend={d.purposeLegend}>
              {ALL_PURPOSES.map((p) => (
                <Chip
                  key={p}
                  checked={value.purpose.includes(p)}
                  onToggle={() => onChange({ ...value, purpose: toggle<AIPurpose>(value.purpose, p) })}
                >
                  {t.labels.purpose[p]}
                </Chip>
              ))}
            </ChipGroup>
          </Row>

          <Row label={d.description} htmlFor="decl-description" error={errors.description} top>
            <textarea
              id="decl-description"
              rows={3}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? 'decl-description-error' : undefined}
              placeholder={d.descriptionPlaceholder}
              className={cn(
                'w-full resize-y rounded-md border bg-background px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-[13px]',
                errors.description ? 'border-destructive' : 'border-border',
              )}
            />
          </Row>
        </>
      )}

      {autoIzden && <p className="pt-1 text-xs text-muted-foreground sm:pl-[152px]">{d.autoNote(hintsSince)}</p>}
    </section>
  )
}

function Row(props: { label: string; children: React.ReactNode; error?: string; htmlFor?: string; top?: boolean }) {
  const errorId = props.htmlFor ? `${props.htmlFor}-error` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5 py-1.5 sm:flex-row sm:gap-3', props.top ? 'sm:items-start' : 'sm:items-center')}>
      {props.htmlFor ? (
        <label htmlFor={props.htmlFor} className={cn('shrink-0 text-[13px] text-muted-foreground sm:w-[140px]', props.top && 'sm:pt-2')}>
          {props.label}
        </label>
      ) : (
        <span className="shrink-0 text-[13px] text-muted-foreground sm:w-[140px]">{props.label}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {props.children}
        {props.error && (
          <span id={errorId} role="alert" className="text-xs text-danger-ink">
            {props.error}
          </span>
        )}
      </div>
    </div>
  )
}

function Segment(props: { value: string; checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  const id = useId()
  return (
    <label
      className={cn(
        'relative flex h-9 cursor-pointer items-center rounded-[5px] px-4 text-[13px] has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 lg:h-[26px] lg:px-3',
        props.checked ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_var(--input)]' : 'text-muted-foreground',
      )}
    >
      {/* Явное value и связь через aria-labelledby: без них инструменты доступности видят radio "on" без подписи. */}
      <input
        type="radio"
        name="used_ai"
        value={props.value}
        aria-labelledby={id}
        className="sr-only"
        checked={props.checked}
        onChange={props.onSelect}
      />
      <span id={id}>{props.children}</span>
    </label>
  )
}

function ChipGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  )
}

function Chip(props: { checked: boolean; onToggle: () => void; ai?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-[5px] border px-2.5 text-[13px] has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 lg:h-7',
        props.checked
          ? 'border-transparent bg-secondary font-medium text-foreground'
          : 'border-dashed border-input text-muted-foreground hover:text-foreground',
      )}
    >
      <input type="checkbox" className="sr-only" checked={props.checked} onChange={props.onToggle} />
      {props.checked && (props.ai ? <AiDot /> : <Check className="size-3" aria-hidden />)}
      {props.children}
    </label>
  )
}
