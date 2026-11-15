import type { ErrorCode } from './types'

/** Ошибка API в формате спеки: { error: { code, message } }. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode

  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  502: 'AI_UNAVAILABLE',
}

export function codeForStatus(status: number): ErrorCode {
  return STATUS_TO_CODE[status] ?? 'VALIDATION_ERROR'
}

/** Текст для пользователя. Для 502 — формулировка из спеки (раздел 7). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AI_UNAVAILABLE') return 'Подсказка временно недоступна'
    return err.message
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.'
}
