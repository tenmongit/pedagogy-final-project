import { Check } from 'lucide-react'
import type { AIDeclaration, AIPurpose, AITool } from '@/api'
import { AiDot } from '@/components/izden/marks'
import { ALL_PURPOSES, ALL_TOOLS, toggle, type VersionErrors } from '@/lib/declaration'
import { PURPOSE_LABEL, TOOL_LABEL, plural } from '@/lib/labels'
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
  return (
    <section aria-labelledby="decl-title" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
        <h2 id="decl-title" className="text-sm font-semibold">
          Как я использовал ИИ
        </h2>
        <span className="text-xs text-muted-foreground">Обязательно для каждой версии</span>
      </div>

      <Row label="Использовал ИИ">
        <fieldset className="inline-flex w-fit self-start rounded-[7px] bg-secondary p-0.5">
          <legend className="sr-only">Использовал ли ИИ в этой версии</legend>
          <Segment checked={!value.used_ai} onSelect={() => onChange({ ...value, used_ai: false })}>
            Нет
          </Segment>
          <Segment checked={value.used_ai} onSelect={() => onChange({ ...value, used_ai: true })}>
            Да
          </Segment>
        </fieldset>
      </Row>

      {value.used_ai && (
        <>
          <Row label="Инструменты" error={errors.tools}>
            <ChipGroup legend="Какими инструментами ИИ пользовались">
              {ALL_TOOLS.map((tool) => (
                <Chip
                  key={tool}
                  checked={value.tools.includes(tool)}
                  onToggle={() => onChange({ ...value, tools: toggle<AITool>(value.tools, tool) })}
                  ai
                >
                  {TOOL_LABEL[tool]}
                  {tool === 'izden_hints' && autoIzden && value.tools.includes(tool) && (
                    <span className="font-normal text-muted-foreground">· авто</span>
                  )}
                </Chip>
              ))}
            </ChipGroup>
          </Row>

          <Row label="Для чего">
            <ChipGroup legend="Для чего использовали ИИ">
              {ALL_PURPOSES.map((p) => (
                <Chip
                  key={p}
                  checked={value.purpose.includes(p)}
                  onToggle={() => onChange({ ...value, purpose: toggle<AIPurpose>(value.purpose, p) })}
                >
                  {PURPOSE_LABEL[p]}
                </Chip>
              ))}
            </ChipGroup>
          </Row>

          <Row label="Что взял от ИИ" htmlFor="decl-description" error={errors.description} top>
            <textarea
              id="decl-description"
              rows={3}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? 'decl-description-error' : undefined}
              placeholder="Своими словами: что именно взяли и как переработали"
              className={cn(
                'w-full resize-y rounded-md border px-2.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-[13px]',
                errors.description ? 'border-destructive' : 'border-border',
              )}
            />
          </Row>
        </>
      )}

      {autoIzden && (
        <p className="pt-1 text-xs text-muted-foreground sm:pl-[152px]">
          «Подсказки Izden» отмечены автоматически: после прошлой версии было{' '}
          {plural(hintsSince, 'подсказка', 'подсказки', 'подсказок')}.
        </p>
      )}
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

function Segment(props: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        'relative flex h-9 cursor-pointer items-center rounded-[5px] px-4 text-[13px] has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 lg:h-[26px] lg:px-3',
        props.checked ? 'bg-background font-medium text-foreground shadow-[0_0_0_1px_#E3E3E3]' : 'text-muted-foreground',
      )}
    >
      <input type="radio" name="used_ai" className="sr-only" checked={props.checked} onChange={props.onSelect} />
      {props.children}
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
