import type { AIDeclaration, AIPurpose, AITool } from '@/api'
import { LIMITS } from '@/api/types'
import type { Messages } from '@/i18n/ru'

export const EMPTY_DECLARATION: AIDeclaration = { used_ai: false, tools: [], purpose: [], description: '' }

export const ALL_TOOLS: AITool[] = ['izden_hints', 'chatgpt', 'claude', 'gemini', 'other']
export const ALL_PURPOSES: AIPurpose[] = [
  'ideas',
  'structure',
  'sources',
  'grammar',
  'translation',
  'generated_text',
  'other',
]

export interface VersionErrors {
  text?: string
  tools?: string
  description?: string
}

/** Те же правила, что на бэкенде (раздел 6 спеки), чтобы студент увидел ошибку до отправки. */
export function validateVersion(text: string, d: AIDeclaration, t: Messages): VersionErrors {
  const errors: VersionErrors = {}
  if (!text.trim()) errors.text = t.declaration.errTextEmpty
  else if (text.length > LIMITS.textMax) errors.text = t.declaration.errTextTooLong
  if (d.used_ai) {
    if (d.tools.length === 0) errors.tools = t.declaration.errTools
    if (!d.description.trim()) errors.description = t.declaration.errDescription
  }
  return errors
}

/** При used_ai = false инструменты и цели по спеке пустые. */
export function normalizeDeclaration(d: AIDeclaration): AIDeclaration {
  if (!d.used_ai) return EMPTY_DECLARATION
  return { ...d, description: d.description.trim() }
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}
