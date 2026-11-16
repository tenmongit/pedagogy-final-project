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

const STORAGE_KEY = 'izden.mockdb.v1'
const MOCK_HINT_PREFIX = '[Демо: ИИ-модуль ещё не подключён, это заготовленный ответ]'

// ---------------------------------------------------------------------------
// Сид: 1 преподаватель, 3 студента, 1 задание. У Данияра работа на финале с историей
// версий и подсказок (раздел 8), у Айгерим — на черновике, у Алии работы нет.
// ---------------------------------------------------------------------------

const none: AIDeclaration = { used_ai: false, tools: [], purpose: [], description: '' }

function seed(): DB {
  const users: User[] = [
    { id: 1, name: 'Преподаватель Демо', role: 'teacher' },
    { id: 2, name: 'Айгерим Студент', role: 'student' },
    { id: 3, name: 'Данияр Студент', role: 'student' },
    { id: 4, name: 'Алия Студент', role: 'student' },
  ]
  const assignments: DB['assignments'] = [
    {
      id: 1,
      teacher_id: 1,
      title: 'Эссе «ИИ в высшем образовании»',
      description: 'Аргументированное эссе на 800–1000 слов с опорой минимум на 3 источника.',
      deadline: '2026-11-25T13:00:00Z',
      created_at: '2026-11-03T06:00:00Z',
    },
  ]
  const works: Work[] = [
    { id: 1, assignment_id: 1, student_id: 3, current_stage: 'final', status: 'awaiting_defense', created_at: '2026-11-04T09:00:00Z' },
    { id: 2, assignment_id: 1, student_id: 2, current_stage: 'draft', status: 'in_progress', created_at: '2026-11-06T10:00:00Z' },
  ]

  const finalText =
    'Запрет ИИ в вузах не решает проблему, а прячет её. Студенты всё равно пользуются ChatGPT, только без обратной связи и без следа в работе. Поэтому вопрос не в том, разрешать ли ИИ, а в том, как сделать его использование видимым.\n\n' +
    'Главное возражение: ИИ лишает студента навыка письма. Но это верно, только если ИИ пишет вместо студента. Формирующая обратная связь, когда ИИ задаёт вопросы и указывает на слабые места, оставляет работу над текстом самому студенту.\n\n' +
    'Видеть процесс надёжнее, чем угадывать по результату. Версии, подсказки и декларация показывают преподавателю, как появилась работа, без детекторов, которые ошибаются.'

  const submissions: Submission[] = [
    { id: 1, work_id: 1, stage: 'topic', version: 1, text: 'ИИ в образовании', ai_declaration: none, created_at: '2026-11-05T08:10:00Z' },
    { id: 2, work_id: 1, stage: 'topic', version: 2, text: 'Открытое использование ИИ в вузе вместо запрета: на примере СРСП', ai_declaration: none, created_at: '2026-11-06T12:30:00Z' },
    {
      id: 3, work_id: 1, stage: 'plan', version: 1,
      text: '1. Введение: студенты уже пользуются ИИ\n2. Аргумент о навыке письма и контраргумент\n3. Аргумент об академической честности\n4. Вывод: видимость процесса вместо запрета',
      ai_declaration: { used_ai: true, tools: ['izden_hints'], purpose: ['structure'], description: 'После подсказки Izden добавил в план отдельный пункт под контраргумент.' },
      created_at: '2026-11-09T15:00:00Z',
    },
    { id: 4, work_id: 1, stage: 'draft', version: 1, text: 'Запрет ИИ в вузах не решает проблему, а прячет её. Студенты всё равно пользуются ChatGPT…', ai_declaration: none, created_at: '2026-11-11T17:20:00Z' },
    {
      id: 5, work_id: 1, stage: 'draft', version: 2,
      text: 'Запрет ИИ в вузах не решает проблему, а прячет её. Студенты всё равно пользуются ChatGPT, только без обратной связи и без следа в работе. На олимпиаде по дебатам этот вопрос обсуждали как главный для образования…',
      ai_declaration: { used_ai: true, tools: ['izden_hints', 'chatgpt'], purpose: ['structure', 'grammar'], description: 'ChatGPT предложил поменять местами 2 и 3 абзацы, я согласился. Грамматику проверил, правки внёс сам.' },
      created_at: '2026-11-13T09:05:00Z',
    },
    { id: 6, work_id: 1, stage: 'final', version: 1, text: finalText, ai_declaration: none, created_at: '2026-11-15T04:30:00Z' },

    { id: 7, work_id: 2, stage: 'topic', version: 1, text: 'ИИ и студенты', ai_declaration: none, created_at: '2026-11-07T11:00:00Z' },
    { id: 8, work_id: 2, stage: 'topic', version: 2, text: 'Почему открытое использование ИИ лучше запрета в СРСП', ai_declaration: none, created_at: '2026-11-08T11:00:00Z' },
    { id: 9, work_id: 2, stage: 'plan', version: 1, text: '1. Введение\n2. Аргумент о навыке письма\n3. Аргумент о честности\n4. Вывод', ai_declaration: none, created_at: '2026-11-10T11:00:00Z' },
    {
      id: 10, work_id: 2, stage: 'draft', version: 1,
      text: 'Искусственный интеллект стал частью учёбы почти каждого студента. Вопрос уже не в том, запрещать ли ИИ, а в том, как сделать его использование открытым.\n\nСторонники запрета считают, что ИИ лишает студента навыка самостоятельно формулировать мысль.',
      ai_declaration: none, created_at: '2026-11-14T13:20:00Z',
    },
  ]

  const feedback: Feedback[] = [
    { id: 1, submission_id: 1, teacher_id: 1, text: 'Слишком широко. Что именно про ИИ в образовании вы хотите доказать?', created_at: '2026-11-05T10:00:00Z' },
    { id: 2, submission_id: 4, teacher_id: 1, text: 'Тезис ясный, но аргумент про честность пока держится на ощущении. Нужен источник.', created_at: '2026-11-12T06:00:00Z' },
    { id: 3, submission_id: 5, teacher_id: 1, text: 'Логика стала лучше. Пример с олимпиадой не связан с тезисом: либо свяжите, либо уберите.', created_at: '2026-11-14T05:15:00Z' },
    { id: 4, submission_id: 10, teacher_id: 1, text: 'Тезис понятный. Во втором абзаце контраргумент назван, но не разобран: почему навык письма всё-таки сохраняется? Нужен хотя бы один источник.', created_at: '2026-11-15T04:40:00Z' },
  ]

  const hint = (id: number, work_id: number, stage: Stage, q: string, a: string, at: string): AIHintLog => ({
    id, work_id, stage, student_question: q, student_text_snapshot: '', hint: a, created_at: at,
  })
  const hints: AIHintLog[] = [
    hint(1, 1, 'plan', 'Все ли части есть в плане?', 'Где в плане место для возражений против вашей позиции? Чем заканчивается каждый пункт: выводом или новым вопросом?', '2026-11-08T14:00:00Z'),
    hint(2, 1, 'plan', 'Как назвать понятие, когда ИИ помогает вопросами?', 'Посмотрите термин «формирующая обратная связь». Ключевые слова для поиска: «formative feedback», «AI writing assistant».', '2026-11-08T14:20:00Z'),
    hint(3, 1, 'draft', 'Понятен ли главный тезис?', 'Тезис в первом абзаце понятен. Какой аргумент его поддерживает сильнее всего и стоит ли он первым?', '2026-11-10T16:00:00Z'),
    hint(4, 1, 'draft', 'Как усилить аргумент про честность?', 'Аргумент держится на ощущении, что «детекторы ошибаются». Какие данные это подтверждают? Ключевые слова: «AI text detector accuracy».', '2026-11-12T16:10:00Z'),
    hint(5, 1, 'draft', 'Нормальный ли порядок абзацев?', 'Какой абзац отвечает на главное возражение? Если он идёт последним, успевает ли читатель с ним согласиться?', '2026-11-12T16:30:00Z'),
    hint(6, 1, 'draft', 'Нужен ли пример из жизни?', 'Пример полезен, если он прямо подтверждает тезис. Какой тезис подтверждает ваш пример?', '2026-11-12T16:45:00Z'),
    hint(7, 1, 'final', 'Что проверить перед сдачей?', 'Отвечает ли вывод на вопрос из введения? Есть ли ссылка на каждый источник? Нет ли абзаца без своего тезиса?', '2026-11-14T18:00:00Z'),
    hint(8, 2, 'draft', 'Достаточно ли раскрыт контраргумент во 2 абзаце?', 'Контраргумент назван, но ответ на него в одно предложение. Что вы понимаете под «навыком письма»: структуру, аргументацию, стиль?', '2026-11-15T05:48:00Z'),
    hint(9, 2, 'draft', 'Напиши заключение к эссе', 'Готовое заключение не напишу, это ваша часть работы. Вместо этого: какой один вывод должен остаться у читателя? Отвечает ли он на вопрос из введения?', '2026-11-15T06:05:00Z'),
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
