import type { IzdenApi } from './contract'
import { ApiError, codeForStatus } from './errors'
import { notifyUnauthorized } from './session'
import { tokenStore } from './token'
import type { ErrorBody } from './types'

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'VALIDATION_ERROR', 'Сервер недоступен. Проверьте подключение.')
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  let message = `Ошибка ${res.status}`
  let code = codeForStatus(res.status)
  try {
    const data = (await res.json()) as Partial<ErrorBody>
    if (data.error) {
      message = data.error.message
      code = data.error.code
    }
  } catch {
    // тело не JSON — оставляем общее сообщение
  }
  if (res.status === 401) notifyUnauthorized()
  throw new ApiError(res.status, code, message)
}

export const httpApi: IzdenApi = {
  listDemoUsers: () => request('GET', '/users/demo'),
  login: (userId) => request('POST', '/auth/login', { user_id: userId }),
  me: () => request('GET', '/me'),

  listAssignments: () => request('GET', '/assignments'),
  createAssignment: (input) => request('POST', '/assignments', input),
  getAssignment: (id) => request('GET', `/assignments/${id}`),
  listWorks: (assignmentId) => request('GET', `/assignments/${assignmentId}/works`),

  startWork: (assignmentId) => request('POST', `/assignments/${assignmentId}/works`),
  getWork: (workId) => request('GET', `/works/${workId}`),
  advanceWork: (workId) => request('POST', `/works/${workId}/advance`),

  submitVersion: (workId, input) => request('POST', `/works/${workId}/submissions`, input),
  addFeedback: (submissionId, text) =>
    request('POST', `/submissions/${submissionId}/feedback`, { text }),

  requestHint: (workId, input) => request('POST', `/works/${workId}/ai/hint`, input),
  getHintLog: (workId) => request('GET', `/works/${workId}/ai/log`),
  generateDefenseQuestions: (workId) => request('POST', `/works/${workId}/ai/defense-questions`),
  getDefenseQuestions: (workId) => request('GET', `/works/${workId}/ai/defense-questions`),
  updateDefenseQuestions: (workId, questions) =>
    request('PUT', `/works/${workId}/ai/defense-questions`, { questions }),

  setGrade: (workId, input) => request('PUT', `/works/${workId}/grade`, input),
}
