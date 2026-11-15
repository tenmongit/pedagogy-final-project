/**
 * Все запросы и мутации — только через эти хуки. Экраны не пишут ключи кэша руками.
 * Каждая мутация сама знает, какие данные после неё устарели.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from './index'
import type { AssignmentInput, DefenseQuestion, GradeInput, HintInput, SubmissionInput } from './types'

export const qk = {
  demoUsers: ['demoUsers'] as const,
  assignments: ['assignments'] as const,
  assignment: (id: number) => ['assignment', id] as const,
  /** Префикс всех списков работ: ['works', assignmentId]. */
  worksAll: ['works'] as const,
  works: (assignmentId: number) => ['works', assignmentId] as const,
  work: (id: number) => ['work', id] as const,
  hintLog: (workId: number) => ['hintLog', workId] as const,
  defense: (workId: number) => ['defense', workId] as const,
}

/** Работа изменилась: её детали, лог ИИ, списки работ у преподавателя и «Мои работы». */
function invalidateWork(qc: QueryClient, workId: number) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.work(workId) }),
    qc.invalidateQueries({ queryKey: qk.hintLog(workId) }),
    qc.invalidateQueries({ queryKey: qk.worksAll }),
    qc.invalidateQueries({ queryKey: qk.assignments }),
  ])
}

// --- Чтение -----------------------------------------------------------------

export const useDemoUsers = () => useQuery({ queryKey: qk.demoUsers, queryFn: api.listDemoUsers })

export const useAssignments = (enabled = true) =>
  useQuery({ queryKey: qk.assignments, queryFn: api.listAssignments, enabled })

export const useAssignment = (id: number, enabled = true) =>
  useQuery({ queryKey: qk.assignment(id), queryFn: () => api.getAssignment(id), enabled })

export const useWorks = (assignmentId: number) =>
  useQuery({ queryKey: qk.works(assignmentId), queryFn: () => api.listWorks(assignmentId) })

export const useWork = (id: number) => useQuery({ queryKey: qk.work(id), queryFn: () => api.getWork(id) })

export const useHintLog = (workId: number) =>
  useQuery({ queryKey: qk.hintLog(workId), queryFn: () => api.getHintLog(workId) })

/** Только для преподавателя: студенту эндпоинт отвечает 403. */
export const useDefenseQuestions = (workId: number, enabled = true) =>
  useQuery({ queryKey: qk.defense(workId), queryFn: () => api.getDefenseQuestions(workId), enabled })

// --- Мутации студента -------------------------------------------------------

export function useStartWork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: number) => api.startWork(assignmentId),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: qk.assignments }),
      qc.invalidateQueries({ queryKey: qk.worksAll }),
    ]),
  })
}

export function useSubmitVersion(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmissionInput) => api.submitVersion(workId, input),
    onSuccess: () => invalidateWork(qc, workId),
  })
}

export function useAdvanceWork(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.advanceWork(workId),
    onSuccess: () => invalidateWork(qc, workId),
  })
}

export function useRequestHint(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: HintInput) => api.requestHint(workId, input),
    onSuccess: () => invalidateWork(qc, workId),
  })
}

// --- Мутации преподавателя --------------------------------------------------

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignmentInput) => api.createAssignment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments }),
  })
}

export function useAddFeedback(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ submissionId, text }: { submissionId: number; text: string }) =>
      api.addFeedback(submissionId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.work(workId) }),
  })
}

export function useGenerateDefenseQuestions(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.generateDefenseQuestions(workId),
    onSuccess: (data) => qc.setQueryData(qk.defense(workId), data),
  })
}

export function useUpdateDefenseQuestions(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (questions: DefenseQuestion[]) => api.updateDefenseQuestions(workId, questions),
    onSuccess: (data) => qc.setQueryData(qk.defense(workId), data),
  })
}

export function useSetGrade(workId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GradeInput) => api.setGrade(workId, input),
    onSuccess: () => invalidateWork(qc, workId),
  })
}
