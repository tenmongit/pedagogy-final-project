import type {
  AIHintLog,
  Assignment,
  AssignmentInput,
  DefenseQuestion,
  DefenseQuestions,
  Feedback,
  Grade,
  GradeInput,
  HintInput,
  LoginResponse,
  Submission,
  SubmissionInput,
  User,
  Work,
  WorkDetail,
  WorkSummary,
} from './types'

/**
 * Один метод — один эндпоинт из раздела 6 спеки.
 * Две реализации: http.ts (настоящий бэкенд) и mock.ts (данные в браузере).
 */
export interface IzdenApi {
  // Auth
  listDemoUsers(): Promise<User[]> // GET  /api/users/demo
  login(userId: number): Promise<LoginResponse> // POST /api/auth/login
  me(): Promise<User> // GET  /api/me

  // Задания
  listAssignments(): Promise<Assignment[]> // GET  /api/assignments
  createAssignment(input: AssignmentInput): Promise<Assignment> // POST /api/assignments
  getAssignment(id: number): Promise<Assignment> // GET  /api/assignments/{id}
  listWorks(assignmentId: number): Promise<WorkSummary[]> // GET  /api/assignments/{id}/works

  // Работа
  startWork(assignmentId: number): Promise<Work> // POST /api/assignments/{id}/works
  getWork(workId: number): Promise<WorkDetail> // GET  /api/works/{id}
  advanceWork(workId: number): Promise<Work> // POST /api/works/{id}/advance

  // Версии и фидбэк
  submitVersion(workId: number, input: SubmissionInput): Promise<Submission> // POST /api/works/{id}/submissions
  addFeedback(submissionId: number, text: string): Promise<Feedback> // POST /api/submissions/{id}/feedback

  // ИИ
  requestHint(workId: number, input: HintInput): Promise<AIHintLog> // POST /api/works/{id}/ai/hint
  getHintLog(workId: number): Promise<AIHintLog[]> // GET  /api/works/{id}/ai/log
  generateDefenseQuestions(workId: number): Promise<DefenseQuestions> // POST /api/works/{id}/ai/defense-questions
  getDefenseQuestions(workId: number): Promise<DefenseQuestions | null> // GET  /api/works/{id}/ai/defense-questions
  updateDefenseQuestions(workId: number, questions: DefenseQuestion[]): Promise<DefenseQuestions> // PUT /api/works/{id}/ai/defense-questions

  // Оценка
  setGrade(workId: number, input: GradeInput): Promise<Grade> // PUT  /api/works/{id}/grade
}
