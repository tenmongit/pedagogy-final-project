import type { AIPurpose, AITool, Role, Stage, WorkStatus } from '@/api'

export const STAGE_LABEL: Record<Stage, string> = {
  topic: 'Тема',
  plan: 'План',
  draft: 'Черновик',
  final: 'Финал',
}

export const STATUS_LABEL: Record<WorkStatus, string> = {
  in_progress: 'В работе',
  awaiting_defense: 'Ожидает защиты',
  graded: 'Оценено',
}

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
}

export const TOOL_LABEL: Record<AITool, string> = {
  izden_hints: 'Подсказки Izden',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  other: 'Другое',
}

export const PURPOSE_LABEL: Record<AIPurpose, string> = {
  ideas: 'Идеи',
  structure: 'Структура',
  sources: 'Источники',
  grammar: 'Грамматика',
  translation: 'Перевод',
  generated_text: 'Сгенерированный текст',
  other: 'Другое',
}

const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** «15 нояб.» → «15 ноя» */
export function formatDate(iso: string): string {
  return shortDate.format(new Date(iso)).replace('.', '')
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso)).replace('.', '')
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** «1 версия», «2 версии», «5 версий». */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}
