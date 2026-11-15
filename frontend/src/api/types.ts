// Типы строго по CLAUDE.md, разделы 5 (модель данных) и 6 (API-контракт).
// Если бэкенд отдаёт что-то другое, правим бэкенд или спеку через Ерасыла, а не эти типы.

export type Role = 'student' | 'teacher'
export type Stage = 'topic' | 'plan' | 'draft' | 'final'
export type WorkStatus = 'in_progress' | 'awaiting_defense' | 'graded'

export const STAGES: Stage[] = ['topic', 'plan', 'draft', 'final']

/** Все даты — строки ISO 8601 в UTC. */
export type ISODate = string

export interface User {
  id: number
  name: string
  role: Role
}

export interface Assignment {
  id: number
  teacher_id: number
  title: string
  description: string
  deadline: ISODate | null
  created_at: ISODate
  /** Только у студента в GET /api/assignments. */
  my_work_id?: number | null
}

export interface Work {
  id: number
  assignment_id: number
  student_id: number
  current_stage: Stage
  status: WorkStatus
  created_at: ISODate
}

export type AITool = 'izden_hints' | 'chatgpt' | 'claude' | 'gemini' | 'other'
export type AIPurpose =
  | 'ideas'
  | 'structure'
  | 'sources'
  | 'grammar'
  | 'translation'
  | 'generated_text'
  | 'other'

export interface AIDeclaration {
  used_ai: boolean
  /** used_ai = true: хотя бы один; used_ai = false: []. */
  tools: AITool[]
  /** used_ai = false: []. */
  purpose: AIPurpose[]
  /** Обязательно, если used_ai = true. */
  description: string
}

export interface Submission {
  id: number
  work_id: number
  stage: Stage
  version: number
  text: string
  ai_declaration: AIDeclaration
  created_at: ISODate
}

export interface Feedback {
  id: number
  submission_id: number
  teacher_id: number
  text: string
  created_at: ISODate
}

export interface AIHintLog {
  id: number
  work_id: number
  stage: Stage
  student_question: string
  student_text_snapshot: string
  hint: string
  created_at: ISODate
}

export interface DefenseQuestion {
  question: string
  /** Видит только преподаватель. */
  why: string
}

export interface DefenseQuestions {
  id: number
  work_id: number
  questions: DefenseQuestion[]
  edited_by_teacher: boolean
  created_at: ISODate
}

export interface Grade {
  id: number
  work_id: number
  teacher_id: number
  score: number
  comment: string
  created_at: ISODate
}

export interface WorkSummary {
  id: number
  student: User
  current_stage: Stage
  status: WorkStatus
  submissions_count: number
  hints_count: number
  score: number | null
}

export type SubmissionWithFeedback = Submission & { feedback: Feedback[] }

export interface WorkDetail {
  id: number
  assignment: Assignment
  student: User
  current_stage: Stage
  status: WorkStatus
  stages: { stage: Stage; submissions: SubmissionWithFeedback[] }[]
  hints: AIHintLog[]
  grade: Grade | null
}

// --- Тела запросов ---

export interface LoginResponse {
  token: string
  user: User
}

export interface AssignmentInput {
  title: string
  description: string
  deadline?: ISODate | null
}

export interface SubmissionInput {
  text: string
  ai_declaration: AIDeclaration
}

export interface HintInput {
  question: string
  current_text: string
}

export interface GradeInput {
  score: number
  comment: string
}

// --- Ошибки ---

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AI_UNAVAILABLE'

export interface ErrorBody {
  error: { code: ErrorCode; message: string }
}

// --- Ограничения из спеки ---

export const LIMITS = {
  textMax: 20_000,
  questionMax: 1_000,
  hintsPerStage: 10,
  scoreMin: 0,
  scoreMax: 100,
} as const
