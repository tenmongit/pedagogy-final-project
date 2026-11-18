/**
 * Мок-бэкенд в браузере. Повторяет правила из CLAUDE.md (разделы 4–7), чтобы фронт
 * можно было делать до готовности бэкенда. Данные хранятся в localStorage.
 *
 * ВАЖНО (раздел 8, честность демо): ответы «ИИ» здесь — заглушки, они явно подписаны.
 * Мок нельзя показывать на экзамене как работающий ИИ.
 */
import type { IzdenApi } from './contract'
import { ApiError, codeForStatus } from './errors'
import { notifyUnauthorized } from './session'
import { tokenStore } from './token'
import {
  LIMITS,
  STAGES,
  type AIDeclaration,
  type AIHintLog,
  type Assignment,
  type DefenseQuestion,
  type DefenseQuestions,
  type Feedback,
  type Grade,
  type Stage,
  type Submission,
  type User,
  type Work,
  type WorkDetail,
  type WorkSummary,
} from './types'

interface DB {
  seq: number
  users: User[]
  assignments: Omit<Assignment, 'my_work_id'>[]
  works: Work[]
  submissions: Submission[]
  feedback: Feedback[]
  hints: AIHintLog[]
  defense: DefenseQuestions[]
  grades: Grade[]
}

const STORAGE_KEY = 'izden.mockdb.v2'
const MOCK_HINT_PREFIX = '[Демо: ИИ-модуль ещё не подключён, это заготовленный ответ]'

// ---------------------------------------------------------------------------
// Сид: 1 преподаватель, 3 студента, 1 задание. У Daniyar работа на финале с историей
// версий и подсказок (раздел 8), у Aigerim — на черновике, у Aliya работы нет.
// Данные совпадают с backend/app/seed.py.
// ---------------------------------------------------------------------------

const none: AIDeclaration = { used_ai: false, tools: [], purpose: [], description: '' }

function seed(): DB {
  const users: User[] = [
    { id: 1, name: 'Demo Teacher', role: 'teacher' },
    { id: 2, name: 'Aigerim Student', role: 'student' },
    { id: 3, name: 'Daniyar Student', role: 'student' },
    { id: 4, name: 'Aliya Student', role: 'student' },
  ]
  const assignments: DB['assignments'] = [
    {
      id: 1,
      teacher_id: 1,
      title: 'Essay: AI in higher education',
      description: 'An argumentative essay of 800–1000 words drawing on at least 3 sources.',
      deadline: '2026-11-25T13:00:00Z',
      created_at: '2026-11-03T06:00:00Z',
    },
  ]
  const works: Work[] = [
    { id: 1, assignment_id: 1, student_id: 3, current_stage: 'final', status: 'awaiting_defense', created_at: '2026-11-04T09:00:00Z' },
    { id: 2, assignment_id: 1, student_id: 2, current_stage: 'draft', status: 'in_progress', created_at: '2026-11-06T10:00:00Z' },
  ]

  const submissions: Submission[] = [
    { id: 1, work_id: 1, stage: 'topic', version: 1, text: 'AI in education', ai_declaration: none, created_at: '2026-11-05T08:10:00Z' },
    { id: 2, work_id: 1, stage: 'topic', version: 2, text: 'Open AI use at university instead of a ban: the case of supervised independent work (SRSP)', ai_declaration: none, created_at: '2026-11-06T12:30:00Z' },
    { id: 3, work_id: 1, stage: 'plan', version: 1, text: '1. Introduction: students already use AI\n2. The writing skill argument and a counterargument\n3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban', ai_declaration: { used_ai: true, tools: ['izden_hints'], purpose: ['structure'], description: 'After an Izden hint I added a separate point to the plan for the counterargument.' }, created_at: '2026-11-09T15:00:00Z' },
    { id: 4, work_id: 1, stage: 'draft', version: 1, text: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway…', ai_declaration: none, created_at: '2026-11-11T17:20:00Z' },
    { id: 5, work_id: 1, stage: 'draft', version: 2, text: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work. At a debate tournament this question was discussed as the most important one for education…', ai_declaration: { used_ai: true, tools: ['izden_hints', 'chatgpt'], purpose: ['structure', 'grammar'], description: 'ChatGPT suggested swapping paragraphs 2 and 3, and I agreed. I checked the grammar and made the corrections myself.' }, created_at: '2026-11-13T09:05:00Z' },
    { id: 6, work_id: 1, stage: 'final', version: 1, text: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work. So the question is not whether to allow AI, but how to make its use visible.\n\nThe main objection is that AI takes away the skill of writing. But that is true only if AI writes instead of the student. Formative feedback, where AI asks questions and points out weak spots, leaves the work on the text to the student.\n\nSeeing the process is more reliable than guessing from the result. Versions, hints and the declaration show the teacher how the work came about, without detectors that make mistakes.', ai_declaration: none, created_at: '2026-11-15T04:30:00Z' },
    { id: 7, work_id: 2, stage: 'topic', version: 1, text: 'AI and students', ai_declaration: none, created_at: '2026-11-07T11:00:00Z' },
    { id: 8, work_id: 2, stage: 'topic', version: 2, text: 'Why open AI use is better than a ban in supervised independent work (SRSP)', ai_declaration: none, created_at: '2026-11-08T11:00:00Z' },
    { id: 9, work_id: 2, stage: 'plan', version: 1, text: '1. Introduction\n2. The writing skill argument\n3. The integrity argument\n4. Conclusion', ai_declaration: none, created_at: '2026-11-10T11:00:00Z' },
    { id: 10, work_id: 2, stage: 'draft', version: 1, text: 'Artificial intelligence has become part of almost every student\'s studies. The question is no longer whether to ban AI, but how to make its use open.\n\nSupporters of a ban believe that AI takes away a student\'s ability to put their thoughts into words on their own.', ai_declaration: none, created_at: '2026-11-14T13:20:00Z' },
  ]

  const feedback: Feedback[] = [
    { id: 1, submission_id: 1, teacher_id: 1, text: 'Too broad. What exactly do you want to prove about AI in education?', created_at: '2026-11-05T10:00:00Z' },
    { id: 2, submission_id: 4, teacher_id: 1, text: 'The thesis is clear, but the integrity argument still rests on a feeling. You need a source.', created_at: '2026-11-12T06:00:00Z' },
    { id: 3, submission_id: 5, teacher_id: 1, text: 'The logic is better now. The debate tournament example is not connected to the thesis: either connect it or remove it.', created_at: '2026-11-14T05:15:00Z' },
    { id: 4, submission_id: 10, teacher_id: 1, text: 'The thesis is clear. In the second paragraph the counterargument is named but not addressed: why is the writing skill preserved after all? You need at least one source.', created_at: '2026-11-15T04:40:00Z' },
  ]

  // Те же настоящие ответы модели, что и в backend/app/seed_hints.json.
  const hints: AIHintLog[] = [
    { id: 1, work_id: 1, stage: 'plan', student_question: 'Does my plan have all the parts?', student_text_snapshot: '1. Introduction: students already use AI\n2. The writing skill argument\n3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban', hint: '1. Your plan has no clear thesis. After the introduction, what exactly do you claim? Is your position stated early, or does it only appear in the conclusion?\n\n2. Sections 2 and 3 both seem to present problems. Where is the opposing view, such as benefits of AI or reasons to allow it, and where do you respond to it? Where will your evidence go?\n\n3. Your conclusion proposes a visible process, but no body section prepares it. What would make that idea feel earned? Consider whether it needs its own section, and what it would look like in practice.', created_at: '2026-11-08T14:00:00Z' },
    { id: 2, work_id: 1, stage: 'plan', student_question: 'What is it called when AI helps by asking questions?', student_text_snapshot: '1. Introduction: students already use AI\n2. The writing skill argument\n3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban', hint: '1. The approach is called Socratic questioning (or Socratic tutoring). The helper asks guiding questions instead of giving answers, so you reach conclusions yourself. A related term is scaffolding: support that is gradually reduced as you improve.\n\n2. Your plan has no clear thesis. Is it for or against AI in education, or a middle position? Also, where is the counterargument, and which side does each of your two arguments support?\n\n3. Your conclusion mentions a "visible process," but no section prepares it. What evidence will you use, and what would that process look like in practice? Useful search keywords: "process-based assessment," "AI literacy," "formative feedback."', created_at: '2026-11-08T14:20:00Z' },
    { id: 3, work_id: 1, stage: 'draft', student_question: 'Is my main thesis clear?', student_text_snapshot: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work.\n\nIt is fairer for the teacher to see the process than to check the work with a detector: detectors make mistakes.\n\nAI takes away the skill of writing only if it writes instead of the student. At a debate tournament this question was discussed as the most important one for education.', hint: '1. Your thesis is not yet clear. The text makes three claims: bans fail, process-based assessment is fairer than detectors, and AI harms writing only when it replaces the student. Which one is your main position, and how do the others support it?\n\n2. Two claims need evidence: "students use ChatGPT anyway" and "detectors make mistakes". Look for student surveys on AI use and empirical studies of detector accuracy and false positives.\n\n3. The debate tournament is not an argument, since it shows only that people discussed the topic. What reasoning or evidence would persuade a skeptical reader that this question matters most for education?', created_at: '2026-11-10T16:00:00Z' },
    { id: 4, work_id: 1, stage: 'draft', student_question: 'How can I strengthen the integrity argument?', student_text_snapshot: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work.\n\nIt is fairer for the teacher to see the process than to check the work with a detector: detectors make mistakes.\n\nAI takes away the skill of writing only if it writes instead of the student. At a debate tournament this question was discussed as the most important one for education.', hint: '1. Define integrity first. What exactly counts as a violation: hidden use, copying, or unacknowledged help? Without this, your argument that a visible process is fairer than a ban stays vague.\n\n2. Two claims need evidence: that students use AI anyway, and that detectors err. Look for university surveys and studies on false-positive rates. Keywords: "AI detector accuracy", "false positives", "student AI use survey".\n\n3. The debate tournament is an anecdote, not support. Also ask: how exactly would a teacher see the process, and what could go wrong, such as extra workload or students faking drafts?', created_at: '2026-11-12T16:10:00Z' },
    { id: 5, work_id: 1, stage: 'draft', student_question: 'Is the order of my paragraphs OK?', student_text_snapshot: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work.\n\nIt is fairer for the teacher to see the process than to check the work with a detector: detectors make mistakes.\n\nAI takes away the skill of writing only if it writes instead of the student. At a debate tournament this question was discussed as the most important one for education.', hint: '1) Your order is not yet clear because there is no stated main claim. Ask yourself: what is your thesis, and does each paragraph build toward it? The third paragraph, about when AI harms writing skill, may need to come earlier as the core question.\n\n2) Several claims need evidence: that students use AI anyway, and that detectors make mistakes. Look for surveys on student AI use and research on detector accuracy and false positives.\n\n3) A debate discussion shows interest in the topic, not that it is important. What stronger support could you use? Also, how does "seeing the process" connect to the skill argument?', created_at: '2026-11-12T16:30:00Z' },
    { id: 6, work_id: 1, stage: 'draft', student_question: 'Do I need a real-life example?', student_text_snapshot: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work.\n\nIt is fairer for the teacher to see the process than to check the work with a detector: detectors make mistakes.\n\nAI takes away the skill of writing only if it writes instead of the student. At a debate tournament this question was discussed as the most important one for education.', hint: '1. Yes, but evidence matters more than anecdote. "Students use ChatGPT anyway" and "detectors make mistakes" are factual claims. Look for student surveys on AI use and studies of detector accuracy and false positives.\n\n2. The debate tournament is too vague to work as support. Who judged the question "most important," and on what grounds? Ask yourself whether it proves anything or only shows the topic is popular.\n\n3. Your fairness argument needs a concrete case of "seeing the process." What would a teacher actually look at, and what would a skeptic say about the extra workload or students who fake the process?', created_at: '2026-11-12T16:45:00Z' },
    { id: 7, work_id: 1, stage: 'final', student_question: 'What should I check before submitting?', student_text_snapshot: 'Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, only without feedback and without any trace in their work. So the question is not whether to allow AI, but how to make its use visible.\n\nThe main objection is that AI takes away the skill of writing. But that is true only if AI writes instead of the student. Formative feedback, where AI asks questions and points out weak spots, leaves the work on the text to the student.\n\nSeeing the process is more reliable than guessing from the result. Versions, hints and the declaration show the teacher how the work came about, without detectors that make mistakes.', hint: '1. Structure: Check that you have a clear thesis, a counterargument with a response, and a closing part. Right now the text ends without a conclusion. Does each paragraph do one job and lead to the next?\n\n2. References: Claims such as "detectors make mistakes" and "feedback leaves the work to the student" need evidence. Look for peer-reviewed studies on formative feedback and on AI-detector accuracy. Check that the citation style is consistent.\n\n3. Conclusion: Does it answer the question you raised, how to make AI use visible? Also ask whether versions and declarations could be faked, and whether you address that weakness.', created_at: '2026-11-14T18:00:00Z' },
    { id: 8, work_id: 2, stage: 'draft', student_question: 'Is the counterargument in paragraph 2 developed enough?', student_text_snapshot: 'Artificial intelligence has become part of almost every student\'s studies. The question is no longer whether to ban AI, but how to make its use open.\n\nSupporters of a ban believe that AI takes away a student\'s ability to put their thoughts into words on their own.', hint: '1. No, it is not developed yet. Paragraph 2 only states the opposing view in one sentence. What reasoning or evidence would its supporters give? Who exactly are these "supporters": teachers, institutions, researchers?\n\n2. The claim that AI takes away the ability to express thoughts is presented as a belief, not an argument. What would show it is true or false? Look for studies on writing skills and AI use, and for university policy documents.\n\n3. Your thesis needs a response to this view. Does it fully fail, or is it partly right? Also, "almost every student" in paragraph 1 needs a survey or statistic as support.', created_at: '2026-11-15T05:48:00Z' },
    { id: 9, work_id: 2, stage: 'draft', student_question: 'Write the conclusion for my essay', student_text_snapshot: 'Artificial intelligence has become part of almost every student\'s studies. The question is no longer whether to ban AI, but how to make its use open.\n\nSupporters of a ban believe that AI takes away a student\'s ability to put their thoughts into words on their own.', hint: 'I\'m sorry, but I can\'t write the conclusion for you, since it needs to be your own work. What is the main claim your essay argues for, and which point from your body paragraphs do you most want readers to remember?', created_at: '2026-11-15T06:05:00Z' },
  ]

  return { seq: 100, users, assignments, works, submissions, feedback, hints, defense: [], grades: [] }
}

// ---------------------------------------------------------------------------
// Хранилище
// ---------------------------------------------------------------------------

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    // нет доступа к хранилищу или битые данные — начинаем с сида
  }
  return seed()
}

let db = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // данные останутся до перезагрузки
  }
}

/** Сбросить мок к исходному сиду. */
export function resetMockDb() {
  db = seed()
  save()
}

// ---------------------------------------------------------------------------
// Помощники
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString()
const nextId = () => ++db.seq
const wait = () => new Promise((r) => setTimeout(r, 180 + Math.random() * 220))
// Настоящая модель отвечает за 5–10 с; на моках держим 1,5–3 с, чтобы было видно анимацию ожидания.
const aiWait = () => new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500))

function fail(status: number, message: string): never {
  throw new ApiError(status, codeForStatus(status), message)
}

function currentUser(): User {
  const match = /^mock-token-(\d+)$/.exec(tokenStore.get() ?? '')
  const user = match ? db.users.find((u) => u.id === Number(match[1])) : undefined
  if (!user) {
    notifyUnauthorized()
    fail(401, 'Требуется вход')
  }
  return user
}

function requireRole(user: User, role: User['role']) {
  if (user.role !== role) {
    fail(403, role === 'teacher' ? 'Доступно только преподавателю' : 'Доступно только студенту')
  }
}

function findAssignment(user: User, id: number) {
  const a = db.assignments.find((x) => x.id === id)
  if (!a) fail(404, 'Задание не найдено')
  if (user.role === 'teacher' && a.teacher_id !== user.id) fail(403, 'Это задание другого преподавателя')
  return a
}

function findWork(user: User, id: number): Work {
  const w = db.works.find((x) => x.id === id)
  if (!w) fail(404, 'Работа не найдена')
  if (user.role === 'student' && w.student_id !== user.id) fail(403, 'Нельзя смотреть чужую работу')
  if (user.role === 'teacher') findAssignment(user, w.assignment_id)
  return w
}

function ownWorkForWrite(user: User, workId: number): Work {
  requireRole(user, 'student')
  const w = findWork(user, workId)
  if (w.status === 'graded') fail(409, 'Работа уже оценена: сдача и подсказки закрыты')
  return w
}

const clone = <T>(x: T): T => structuredClone(x)

function validateDeclaration(d: AIDeclaration | undefined) {
  if (!d) fail(400, 'Заполните блок «Как я использовал ИИ»')
  if (d.used_ai) {
    if (d.tools.length === 0) fail(400, 'Укажите, какими инструментами ИИ вы пользовались')
    if (!d.description.trim()) fail(400, 'Опишите своими словами, что именно взяли от ИИ')
  } else if (d.tools.length > 0 || d.purpose.length > 0) {
    fail(400, 'Если ИИ не использовался, инструменты и цели должны быть пустыми')
  }
}

const STAGE_HINTS: Record<Stage, string> = {
  topic: 'Что именно в этой теме вы хотите выяснить? Для кого это важно? На каком материале будете опираться?',
  plan: 'Какая часть плана отвечает на главный вопрос? Есть ли место для возражений против вашей позиции?',
  draft: 'Какой абзац держится только на вашем мнении, без источника? Связан ли каждый пример с тезисом?',
  final: 'Отвечает ли вывод на вопрос из введения? Есть ли ссылки на все источники? Нет ли абзаца без тезиса?',
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const mockApi: IzdenApi = {
  async listDemoUsers() {
    await wait()
    return clone(db.users)
  },

  async login(userId) {
    await wait()
    const user = db.users.find((u) => u.id === userId)
    if (!user) fail(404, 'Пользователь не найден')
    return { token: `mock-token-${user.id}`, user: clone(user) }
  },

  async me() {
    await wait()
    return clone(currentUser())
  },

  async listAssignments() {
    await wait()
    const user = currentUser()
    if (user.role === 'teacher') {
      return clone(db.assignments.filter((a) => a.teacher_id === user.id))
    }
    return db.assignments.map((a) => ({
      ...clone(a),
      my_work_id: db.works.find((w) => w.assignment_id === a.id && w.student_id === user.id)?.id ?? null,
    }))
  },

  async createAssignment(input) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    if (!input.title.trim()) fail(400, 'Введите название задания')
    const a = {
      id: nextId(),
      teacher_id: user.id,
      title: input.title.trim(),
      description: input.description.trim(),
      deadline: input.deadline ?? null,
      created_at: nowIso(),
    }
    db.assignments.push(a)
    save()
    return clone(a)
  },

  async getAssignment(id) {
    await wait()
    return clone(findAssignment(currentUser(), id))
  },

  async listWorks(assignmentId) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    findAssignment(user, assignmentId)
    return db.works
      .filter((w) => w.assignment_id === assignmentId)
      .map<WorkSummary>((w) => ({
        id: w.id,
        student: clone(db.users.find((u) => u.id === w.student_id)!),
        current_stage: w.current_stage,
        status: w.status,
        submissions_count: db.submissions.filter((s) => s.work_id === w.id).length,
        hints_count: db.hints.filter((h) => h.work_id === w.id).length,
        score: db.grades.find((g) => g.work_id === w.id)?.score ?? null,
      }))
  },

  async startWork(assignmentId) {
    await wait()
    const user = currentUser()
    requireRole(user, 'student')
    findAssignment(user, assignmentId)
    if (db.works.some((w) => w.assignment_id === assignmentId && w.student_id === user.id)) {
      fail(409, 'Работа по этому заданию уже начата')
    }
    const w: Work = {
      id: nextId(),
      assignment_id: assignmentId,
      student_id: user.id,
      current_stage: 'topic',
      status: 'in_progress',
      created_at: nowIso(),
    }
    db.works.push(w)
    save()
    return clone(w)
  },

  async getWork(workId) {
    await wait()
    const w = findWork(currentUser(), workId)
    const detail: WorkDetail = {
      id: w.id,
      assignment: clone(db.assignments.find((a) => a.id === w.assignment_id)!),
      student: clone(db.users.find((u) => u.id === w.student_id)!),
      current_stage: w.current_stage,
      status: w.status,
      stages: STAGES.map((stage) => ({
        stage,
        submissions: db.submissions
          .filter((s) => s.work_id === w.id && s.stage === stage)
          .sort((a, b) => a.version - b.version)
          .map((s) => ({ ...clone(s), feedback: clone(db.feedback.filter((f) => f.submission_id === s.id)) })),
      })),
      hints: clone(db.hints.filter((h) => h.work_id === w.id)),
      grade: clone(db.grades.find((g) => g.work_id === w.id) ?? null),
    }
    return detail
  },

  async advanceWork(workId) {
    await wait()
    const w = ownWorkForWrite(currentUser(), workId)
    if (w.current_stage === 'final') fail(409, 'Финал — последний этап')
    if (!db.submissions.some((s) => s.work_id === w.id && s.stage === w.current_stage)) {
      fail(409, 'Сначала сдайте хотя бы одну версию на этом этапе')
    }
    w.current_stage = STAGES[STAGES.indexOf(w.current_stage) + 1]
    save()
    return clone(w)
  },

  async submitVersion(workId, input) {
    await wait()
    const w = ownWorkForWrite(currentUser(), workId)
    const text = input.text ?? ''
    if (text.trim().length === 0) fail(400, 'Текст версии не может быть пустым')
    if (text.length > LIMITS.textMax) fail(400, `Текст длиннее ${LIMITS.textMax.toLocaleString('ru')} символов`)
    validateDeclaration(input.ai_declaration)
    const version = db.submissions.filter((s) => s.work_id === w.id && s.stage === w.current_stage).length + 1
    const s: Submission = {
      id: nextId(),
      work_id: w.id,
      stage: w.current_stage,
      version,
      text,
      ai_declaration: clone(input.ai_declaration),
      created_at: nowIso(),
    }
    db.submissions.push(s)
    if (w.current_stage === 'final' && w.status === 'in_progress') w.status = 'awaiting_defense'
    save()
    return clone(s)
  },

  async addFeedback(submissionId, text) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    const s = db.submissions.find((x) => x.id === submissionId)
    if (!s) fail(404, 'Версия не найдена')
    findWork(user, s.work_id)
    if (!text.trim()) fail(400, 'Фидбэк не может быть пустым')
    const f: Feedback = { id: nextId(), submission_id: s.id, teacher_id: user.id, text: text.trim(), created_at: nowIso() }
    db.feedback.push(f)
    save()
    return clone(f)
  },

  async requestHint(workId, input) {
    await aiWait()
    const w = ownWorkForWrite(currentUser(), workId)
    const question = input.question?.trim() ?? ''
    if (!question) fail(400, 'Напишите вопрос к ИИ')
    if (question.length > LIMITS.questionMax) fail(400, `Вопрос длиннее ${LIMITS.questionMax} символов`)
    if ((input.current_text ?? '').length > LIMITS.textMax) fail(400, 'Текст длиннее 20 000 символов')
    const used = db.hints.filter((h) => h.work_id === w.id && h.stage === w.current_stage).length
    if (used >= LIMITS.hintsPerStage) {
      fail(409, `На этом этапе подсказки закончились (${LIMITS.hintsPerStage} из ${LIMITS.hintsPerStage}). Сдайте версию и переходите к следующему этапу.`)
    }
    const h: AIHintLog = {
      id: nextId(),
      work_id: w.id,
      stage: w.current_stage,
      student_question: question,
      student_text_snapshot: input.current_text ?? '',
      hint: `${MOCK_HINT_PREFIX} ${STAGE_HINTS[w.current_stage]}`,
      created_at: nowIso(),
    }
    db.hints.push(h)
    save()
    return clone(h)
  },

  async getHintLog(workId) {
    await wait()
    const w = findWork(currentUser(), workId)
    return clone(db.hints.filter((h) => h.work_id === w.id))
  },

  async generateDefenseQuestions(workId) {
    await aiWait()
    const user = currentUser()
    requireRole(user, 'teacher')
    const w = findWork(user, workId)
    if (!db.submissions.some((s) => s.work_id === w.id && s.stage === 'final')) {
      fail(409, 'Вопросы можно сгенерировать после сдачи финальной версии')
    }
    const questions: DefenseQuestion[] = [
      { question: `${MOCK_HINT_PREFIX} Какой главный тезис вашей работы и какой аргумент поддерживает его сильнее всего?`, why: 'Заглушка: настоящий ИИ сошлётся на конкретное место финала.' },
      { question: `${MOCK_HINT_PREFIX} Что изменилось между черновиком и финалом и почему?`, why: 'Заглушка: настоящий ИИ сравнит версии.' },
      { question: `${MOCK_HINT_PREFIX} Как вы переработали то, что взяли от ИИ?`, why: 'Заглушка: настоящий ИИ опирается на декларации и лог подсказок.' },
    ]
    const record: DefenseQuestions = { id: nextId(), work_id: w.id, questions, edited_by_teacher: false, created_at: nowIso() }
    db.defense = db.defense.filter((d) => d.work_id !== w.id)
    db.defense.push(record)
    save()
    return clone(record)
  },

  async getDefenseQuestions(workId) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    const w = findWork(user, workId)
    return clone(db.defense.find((d) => d.work_id === w.id) ?? null)
  },

  async updateDefenseQuestions(workId, questions) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    const w = findWork(user, workId)
    const record = db.defense.find((d) => d.work_id === w.id)
    if (!record) fail(404, 'Вопросы ещё не сгенерированы')
    if (questions.length < 3 || questions.length > 4) fail(400, 'Вопросов должно быть 3 или 4')
    if (questions.some((q) => !q.question.trim())) fail(400, 'У каждого вопроса должен быть текст')
    record.questions = clone(questions)
    record.edited_by_teacher = true
    save()
    return clone(record)
  },

  async setGrade(workId, input) {
    await wait()
    const user = currentUser()
    requireRole(user, 'teacher')
    const w = findWork(user, workId)
    if (w.status === 'in_progress') fail(409, 'Оценку можно поставить после сдачи финальной версии')
    if (!Number.isInteger(input.score) || input.score < LIMITS.scoreMin || input.score > LIMITS.scoreMax) {
      fail(400, 'Оценка — целое число от 0 до 100')
    }
    let g = db.grades.find((x) => x.work_id === w.id)
    if (g) {
      g.score = input.score
      g.comment = input.comment
    } else {
      g = { id: nextId(), work_id: w.id, teacher_id: user.id, score: input.score, comment: input.comment, created_at: nowIso() }
      db.grades.push(g)
    }
    w.status = 'graded'
    save()
    return clone(g)
  },
}
