"""Демо-данные (раздел 8): создаются при первом запуске на пустой базе (SEED_DEMO=1).

1 преподаватель, 8 студентов, 1 задание. Работы на разных этапах, чтобы список преподавателя
не выглядел пустым: у Daniyar финал с историей версий и подсказок (для показа вопросов защиты),
у Aigerim черновик (для живой подсказки), у трёх студентов работа уже оценена.
Тексты на английском: защита проходит на английском, а ИИ отвечает на языке работы.
Данные совпадают с моками фронта.

Ответы подсказок и вопросы защиты оценённых работ лежат в seed_hints.json. Это настоящие ответы
модели, полученные скриптом scripts/seed_hints.py через тот же код и промпты, что на сайте.
Вручную не правились. Модель и время генерации записаны в том же файле.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AIHintLog, Assignment, DefenseQuestions, Feedback, Grade, Submission, User, Work

AI_ANSWERS = Path(__file__).with_name("seed_hints.json")
# Скрипт генерации сначала поднимает сид без вопросов защиты, чтобы получить их через API.
REQUIRE_DEFENSE = True

NONE = {"used_ai": False, "tools": [], "purpose": [], "description": ""}


def used(tools: list[str], purpose: list[str], description: str) -> dict:
    return {"used_ai": True, "tools": tools, "purpose": purpose, "description": description}


# Ключ студента: (имя, ключ работы или None). Порядок задаёт id пользователей.
STUDENTS = [
    ("Aigerim K.", 2),
    ("Daniyar M.", 1),
    ("Aliya S.", 3),
    ("Timur B.", 4),
    ("Dana Zh.", 5),
    ("Arman T.", 7),
    ("Madina O.", 8),
    ("Nurlan A.", 6),
]

# Ключ работы: (current_stage, status, created_at). Порядок задаёт id работ и порядок в списке.
WORKS = {
    1: ("final", "awaiting_defense", "2026-11-04T09:00"),
    2: ("draft", "in_progress", "2026-11-06T10:00"),
    3: ("final", "graded", "2026-11-03T12:00"),
    4: ("final", "graded", "2026-11-04T08:30"),
    5: ("final", "graded", "2026-11-03T16:40"),
    6: ("draft", "in_progress", "2026-11-07T09:15"),
    7: ("plan", "in_progress", "2026-11-09T14:00"),
    8: ("topic", "in_progress", "2026-11-12T10:20"),
}

# --- Daniyar (1): финал, ждёт защиты ------------------------------------------------------------

FINAL_TEXT = (
    "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT "
    "anyway, only without feedback and without any trace in their work. So the question is not "
    "whether to allow AI, but how to make its use visible.\n\n"
    "The main objection is that AI takes away the skill of writing. But that is true only if AI "
    "writes instead of the student. Formative feedback, where AI asks questions and points out "
    "weak spots, leaves the work on the text to the student.\n\n"
    "Seeing the process is more reliable than guessing from the result. Versions, hints and the "
    "declaration show the teacher how the work came about, without detectors that make mistakes."
)
PLAN_SNAPSHOT = (
    "1. Introduction: students already use AI\n2. The writing skill argument\n"
    "3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban"
)
DRAFT_SNAPSHOT = (
    "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, "
    "only without feedback and without any trace in their work.\n\n"
    "It is fairer for the teacher to see the process than to check the work with a detector: "
    "detectors make mistakes.\n\n"
    "AI takes away the skill of writing only if it writes instead of the student. At a debate "
    "tournament this question was discussed as the most important one for education."
)

# --- Aigerim (2): черновик ----------------------------------------------------------------------

AIGERIM_DRAFT = (
    "Artificial intelligence has become part of almost every student's studies. The question is no "
    "longer whether to ban AI, but how to make its use open.\n\n"
    "Supporters of a ban believe that AI takes away a student's ability to put their thoughts into "
    "words on their own."
)

# --- Aliya (3): оценено, 86 ---------------------------------------------------------------------

ALIYA_TOPIC = "Fast feedback from AI tutors in first-year academic writing: does it help students revise?"
ALIYA_PLAN = (
    "1. Introduction: first-year students wait up to two weeks for feedback\n"
    "2. What an AI tutor can and cannot comment on\n"
    "3. My small survey: how often students revise after feedback\n"
    "4. Risk: students accept every suggestion without thinking\n"
    "5. Conclusion: fast questions from AI, final judgement from the teacher"
)
ALIYA_DRAFT_1 = (
    "In our first-year writing course, feedback on an essay usually comes back after ten to "
    "fourteen days. By then most students have already moved on to the next task, so the comments "
    "are read once and forgotten.\n\n"
    "An AI tutor can answer within minutes. It can ask whether a paragraph has a clear claim or "
    "whether an example supports it."
)
ALIYA_DRAFT_2 = (
    "In our first-year writing course, feedback on an essay usually comes back after ten to "
    "fourteen days. By then most students have already moved on to the next task, so the comments "
    "are read once and forgotten.\n\n"
    "An AI tutor can answer within minutes. It can ask whether a paragraph has a clear claim or "
    "whether an example supports it. It cannot judge whether the argument is original or fits the "
    "course, which is still the teacher's job.\n\n"
    "I asked 24 students in my group how many times they revised their last essay. Those who "
    "received any comments within two days revised it twice on average, the others once."
)
ALIYA_FINAL = (
    "In our first-year writing course, feedback on an essay usually comes back after ten to fourteen "
    "days. By then most students have moved on to the next task, so the comments are read once and "
    "forgotten. My question is whether fast feedback from an AI tutor makes students revise more.\n\n"
    "An AI tutor can answer within minutes. It can ask whether a paragraph has a clear claim or "
    "whether an example supports it. It cannot judge whether the argument is original or fits the "
    "course, which is still the teacher's job.\n\n"
    "I asked 24 students in my group how many times they revised their last essay. Those who received "
    "any comments within two days revised it twice on average, the others once. The sample is small "
    "and the groups were not equal, so this shows a direction, not a proof.\n\n"
    "The main risk is that students accept every suggestion without thinking. That is why the tutor "
    "should ask questions instead of rewriting sentences. Fast questions from AI and a final "
    "judgement from the teacher can work together."
)

# --- Timur (4): оценено, 74 ---------------------------------------------------------------------

TIMUR_PLAN = (
    "1. Introduction: universities buy AI detectors\n2. How detectors decide that a text is AI\n"
    "3. False positives and who suffers from them\n4. Conclusion"
)
TIMUR_DRAFT = (
    "Many universities now check essays with AI detectors. A detector gives a percentage, and a "
    "teacher may treat a high number as proof.\n\n"
    "Detectors look at how predictable the words are. Simple and correct English is predictable, so "
    "students who write carefully in a second language can be flagged."
)
TIMUR_FINAL = (
    "Many universities now check essays with AI detectors. A detector gives a percentage, and a "
    "teacher may treat a high number as proof that the student cheated.\n\n"
    "Detectors look at how predictable the words in a text are. Simple and correct English is "
    "predictable, so students who write carefully in a second language can be flagged more often than "
    "native speakers. In Kazakhstan most students write in English as a second or third language.\n\n"
    "A false positive is not a small error for the student. It can mean a failed course and a "
    "conversation about honesty that the student cannot win, because a percentage cannot be argued "
    "with.\n\n"
    "Universities should not use a detector score as evidence. If a teacher has doubts, a short talk "
    "about the work shows much more than a number."
)

# --- Dana (5): оценено, 91 ----------------------------------------------------------------------

DANA_PLAN = (
    "1. Introduction: students already write prompts, but nobody teaches it\n"
    "2. What a good prompt has in common with a good research question\n"
    "3. Counterargument: prompting is a temporary trick, not a skill\n"
    "4. Response: the lasting part is asking precise questions and checking answers\n"
    "5. Conclusion: teach it inside existing courses, not as a separate one"
)
DANA_DRAFT_1 = (
    "Students already ask AI for help every day, but nobody shows them how to ask well. A vague "
    "request gives a vague answer, and students often take it as it is.\n\n"
    "Some teachers say that prompting is a trick that will disappear when models get better."
)
DANA_FINAL = (
    "Students already ask AI for help every day, but nobody shows them how to ask well. A vague "
    "request gives a vague answer, and many students take it as it is. I argue that universities "
    "should teach this as part of academic skills, inside existing courses.\n\n"
    "A good prompt has a lot in common with a good research question. Both need a clear scope, "
    "context and a way to check the answer. When I rewrote my own requests this way, I spent less "
    "time and noticed mistakes in the answers more often.\n\n"
    "The strongest objection is that prompting is a temporary trick. Models change every few months, "
    "so specific phrases will soon be useless. I agree with this about phrases. But the lasting part "
    "is not the wording: it is the habit of asking precise questions and verifying what comes back. "
    "That habit is useful with a search engine, a library database or a colleague.\n\n"
    "So the course does not need a separate subject. It needs one seminar in the first year and "
    "assignments where students show their questions together with their answers."
)

# --- Nurlan (6): черновик -----------------------------------------------------------------------

NURLAN_PLAN = (
    "1. Introduction\n2. Three types of policy: ban, free use, disclosure\n"
    "3. Why disclosure is the most honest option\n4. Conclusion"
)
NURLAN_DRAFT = (
    "Universities answer the question of AI in three ways. Some ban it completely, some allow "
    "everything, and some ask students to disclose how they used it.\n\n"
    "A ban is easy to write but impossible to check. Free use is honest, but then the teacher does "
    "not know what to assess.\n\n"
    "Disclosure looks like the middle way. The student says what AI did, and the teacher can ask "
    "about it."
)

# --- Arman (7): план в работе -------------------------------------------------------------------

ARMAN_PLAN_SNAPSHOT = (
    "1. Introduction: engineering students and English\n2. AI as a conversation partner\n"
    "3. Problems\n4. Conclusion"
)

# (work, stage, version, text, declaration, created_at)
SUBMISSIONS = [
    (1, "topic", 1, "AI in education", NONE, "2026-11-05T08:10"),
    (
        1, "topic", 2,
        "Open AI use at university instead of a ban: the case of supervised independent work (SRSP)",
        NONE, "2026-11-06T12:30",
    ),
    (
        1, "plan", 1,
        "1. Introduction: students already use AI\n2. The writing skill argument and a counterargument\n"
        "3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban",
        used(["izden_hints"], ["structure"],
             "After an Izden hint I added a separate point to the plan for the counterargument."),
        "2026-11-09T15:00",
    ),
    (
        1, "draft", 1,
        "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway…",
        NONE, "2026-11-11T17:20",
    ),
    (
        1, "draft", 2,
        "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, "
        "only without feedback and without any trace in their work. At a debate tournament this question "
        "was discussed as the most important one for education…",
        used(["izden_hints", "chatgpt"], ["structure", "grammar"],
             "ChatGPT suggested swapping paragraphs 2 and 3, and I agreed. "
             "I checked the grammar and made the corrections myself."),
        "2026-11-13T09:05",
    ),
    (1, "final", 1, FINAL_TEXT, NONE, "2026-11-15T04:30"),
    (2, "topic", 1, "AI and students", NONE, "2026-11-07T11:00"),
    (
        2, "topic", 2, "Why open AI use is better than a ban in supervised independent work (SRSP)",
        NONE, "2026-11-08T11:00",
    ),
    (
        2, "plan", 1,
        "1. Introduction\n2. The writing skill argument\n3. The integrity argument\n4. Conclusion",
        NONE, "2026-11-10T11:00",
    ),
    (2, "draft", 1, AIGERIM_DRAFT, NONE, "2026-11-14T13:20"),
    (3, "topic", 1, "AI tutors in writing courses", NONE, "2026-11-03T13:00"),
    (3, "topic", 2, ALIYA_TOPIC, used(["izden_hints"], ["ideas"],
                                       "An Izden hint asked which students and which course I mean. "
                                       "I narrowed the topic to first-year writing myself."),
     "2026-11-04T10:00"),
    (3, "plan", 1, ALIYA_PLAN, NONE, "2026-11-06T09:30"),
    (3, "draft", 1, ALIYA_DRAFT_1, NONE, "2026-11-08T18:10"),
    (3, "draft", 2, ALIYA_DRAFT_2, used(["izden_hints"], ["sources"],
                                         "An Izden hint said my claims need data. I ran a short survey "
                                         "in my group and added the results."),
     "2026-11-10T12:45"),
    (3, "final", 1, ALIYA_FINAL, used(["izden_hints", "other"], ["structure", "grammar"],
                                       "An Izden hint asked whether my conclusion answers my question, "
                                       "so I stated the question in the first paragraph. I checked "
                                       "spelling with a grammar checker; it did not rewrite sentences."),
     "2026-11-12T16:00"),
    (4, "topic", 1, "Why AI detectors should not be used as evidence at university", NONE, "2026-11-04T09:00"),
    (4, "plan", 1, TIMUR_PLAN, used(["izden_hints"], ["structure"],
                                     "An Izden hint asked who is affected by detector errors. "
                                     "I added point 3 about false positives."),
     "2026-11-06T15:20"),
    (4, "draft", 1, TIMUR_DRAFT, NONE, "2026-11-09T11:00"),
    (4, "final", 1, TIMUR_FINAL, used(["chatgpt"], ["translation"],
                                       "I wrote the third paragraph in Russian and asked ChatGPT to "
                                       "translate it into English. Then I changed some words myself."),
     "2026-11-12T20:30"),
    (5, "topic", 1, "Should universities teach prompt writing as an academic skill?", NONE, "2026-11-04T08:00"),
    (5, "plan", 1, DANA_PLAN, used(["izden_hints"], ["structure"],
                                    "An Izden hint asked where my counterargument is. "
                                    "I added points 3 and 4 to the plan."),
     "2026-11-05T19:00"),
    (5, "draft", 1, DANA_DRAFT_1, NONE, "2026-11-08T21:15"),
    (5, "final", 1, DANA_FINAL, NONE, "2026-11-11T17:40"),
    (6, "topic", 1, "University AI policies: ban, free use or disclosure?", NONE, "2026-11-07T10:00"),
    (6, "plan", 1, NURLAN_PLAN, used(["izden_hints"], ["structure"],
                                      "I asked Izden if the order is logical and kept it, "
                                      "but moved my own position to point 3."),
     "2026-11-10T08:45"),
    (6, "draft", 1, NURLAN_DRAFT, NONE, "2026-11-15T19:30"),
    (7, "topic", 1, "AI chatbots as English conversation partners for engineering students", NONE,
     "2026-11-10T09:00"),
    (8, "topic", 1, "AI and exams", NONE, "2026-11-13T08:30"),
]

# ((work, stage, version), text, created_at)
FEEDBACK = [
    ((1, "topic", 1), "Too broad. What exactly do you want to prove about AI in education?", "2026-11-05T10:00"),
    ((1, "draft", 1), "The thesis is clear, but the integrity argument still rests on a feeling. You need a source.",
     "2026-11-12T06:00"),
    (
        (1, "draft", 2),
        "The logic is better now. The debate tournament example is not connected to the thesis: "
        "either connect it or remove it.",
        "2026-11-14T05:15",
    ),
    (
        (2, "draft", 1),
        "The thesis is clear. In the second paragraph the counterargument is named but not addressed: "
        "why is the writing skill preserved after all? You need at least one source.",
        "2026-11-15T04:40",
    ),
    ((3, "topic", 1), "Which students and which course? Right now this could be a whole book.", "2026-11-03T17:00"),
    ((3, "draft", 1), "Good start. What evidence do you have that fast feedback changes anything?", "2026-11-09T08:00"),
    ((3, "final", 1), "Clear question and an honest limitation of the survey. Well done.", "2026-11-13T09:00"),
    ((4, "plan", 1), "Point 3 is the heart of the essay. Plan more space for it.", "2026-11-07T09:00"),
    (
        (4, "final", 1),
        "Strong point about second-language writers. The essay still has no sources: "
        "every claim about detectors needs one.",
        "2026-11-13T10:30",
    ),
    ((5, "draft", 1), "Interesting objection. Do not leave it as the last sentence: answer it.", "2026-11-09T12:00"),
    ((6, "plan", 1), "Clear structure. Will you also discuss what is hard about disclosure?", "2026-11-11T09:30"),
    ((8, "topic", 1), "Too broad. Which exams, and what about AI: cheating, grading, preparation?", "2026-11-14T08:00"),
]

# (work, score, comment, created_at)
GRADES = [
    (
        3, 86,
        "A focused question and a real attempt to collect data. In the defense you explained the limits "
        "of your survey well. Next time compare groups of equal size.",
        "2026-11-16T11:00",
    ),
    (
        4, 74,
        "An important argument, clearly written. In the defense you explained the translated paragraph "
        "in your own words. The essay loses points for having no sources at all.",
        "2026-11-16T11:40",
    ),
    (
        5, 91,
        "The best handling of a counterargument in the group. In the defense you gave a convincing "
        "example of checking an AI answer.",
        "2026-11-16T12:20",
    ),
]

# (work, stage, question, snapshot, created_at). Ответ берётся из AI_ANSWERS по вопросу,
# поэтому вопросы не повторяются.
HINTS = [
    (1, "plan", "Does my plan have all the parts?", PLAN_SNAPSHOT, "2026-11-08T14:00"),
    (1, "plan", "What is it called when AI helps by asking questions?", PLAN_SNAPSHOT, "2026-11-08T14:20"),
    (1, "draft", "Is my main thesis clear?", DRAFT_SNAPSHOT, "2026-11-10T16:00"),
    (1, "draft", "How can I strengthen the integrity argument?", DRAFT_SNAPSHOT, "2026-11-12T16:10"),
    (1, "draft", "Is the order of my paragraphs OK?", DRAFT_SNAPSHOT, "2026-11-12T16:30"),
    (1, "draft", "Do I need a real-life example?", DRAFT_SNAPSHOT, "2026-11-12T16:45"),
    (1, "final", "What should I check before submitting?", FINAL_TEXT, "2026-11-14T18:00"),
    (2, "draft", "Is the counterargument in paragraph 2 developed enough?", AIGERIM_DRAFT, "2026-11-15T05:48"),
    (2, "draft", "Write the conclusion for my essay", AIGERIM_DRAFT, "2026-11-15T06:05"),
    (3, "topic", "How can I make my topic narrower?", "AI tutors in writing courses", "2026-11-04T09:20"),
    (3, "draft", "What kind of evidence would support my point about fast feedback?", ALIYA_DRAFT_1,
     "2026-11-09T19:00"),
    (3, "final", "Does my conclusion answer my question?", ALIYA_FINAL, "2026-11-12T15:30"),
    (4, "plan", "What is missing in my plan?", TIMUR_PLAN, "2026-11-06T14:50"),
    (5, "plan", "Where should the counterargument go in my plan?",
     "1. Introduction\n2. Prompts and research questions\n3. Conclusion", "2026-11-05T18:20"),
    (5, "draft", "How do I answer the objection that prompting is a temporary trick?", DANA_DRAFT_1,
     "2026-11-09T13:10"),
    (6, "plan", "Is the order of points in my plan logical?", NURLAN_PLAN, "2026-11-10T08:10"),
    (6, "draft", "Where is my argument weakest?", NURLAN_DRAFT, "2026-11-15T20:05"),
    (7, "plan", "How should I order the sections of my plan?", ARMAN_PLAN_SNAPSHOT, "2026-11-16T18:30"),
]


def _at(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def ai_answers() -> tuple[dict[str, str], dict[int, list[dict]]]:
    """Ответы модели из AI_ANSWERS: подсказки по вопросу и вопросы защиты по ключу работы."""
    data = json.loads(AI_ANSWERS.read_text(encoding="utf-8")) if AI_ANSWERS.exists() else {}
    hints = {item["question"]: item["hint"] for item in data.get("hints", [])}
    defense = {int(work): questions for work, questions in data.get("defense", {}).items()}
    missing = [question for _, _, question, _, _ in HINTS if not hints.get(question, "").strip()]
    if REQUIRE_DEFENSE:
        missing += [f"вопросы защиты работы {work}" for work, *_ in GRADES if not defense.get(work)]
    if missing:
        raise RuntimeError(f"Нет ответов в {AI_ANSWERS.name} для: {missing}. Запустите scripts/seed_hints.py")
    return hints, defense


def seed(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    hints, defense = ai_answers()

    teacher = User(name="Demo Teacher", role="teacher")
    students = [User(name=name, role="student") for name, _ in STUDENTS]
    db.add_all([teacher, *students])
    db.flush()
    student_by_work = {work: user for (_, work), user in zip(STUDENTS, students) if work}

    assignment = Assignment(
        teacher_id=teacher.id,
        title="Essay: AI in higher education",
        description="An argumentative essay of 800–1000 words drawing on at least 3 sources.",
        deadline=_at("2026-11-25T13:00"),
        created_at=_at("2026-11-03T06:00"),
    )
    db.add(assignment)
    db.flush()

    works = {
        key: Work(assignment_id=assignment.id, student_id=student_by_work[key].id, current_stage=stage,
                  status=status, created_at=_at(at))
        for key, (stage, status, at) in WORKS.items()
    }
    db.add_all(works.values())
    db.flush()

    submissions = {
        (work, stage, version): Submission(work_id=works[work].id, stage=stage, version=version, text=text,
                                           ai_declaration=declaration, created_at=_at(at))
        for work, stage, version, text, declaration, at in SUBMISSIONS
    }
    db.add_all(submissions.values())
    db.flush()

    db.add_all(
        Feedback(submission_id=submissions[key].id, teacher_id=teacher.id, text=text, created_at=_at(at))
        for key, text, at in FEEDBACK
    )
    db.add_all(
        AIHintLog(work_id=works[work].id, stage=stage, student_question=question,
                  student_text_snapshot=snapshot, hint=hints[question], created_at=_at(at))
        for work, stage, question, snapshot, at in HINTS
    )
    for work, score, comment, at in GRADES:
        db.add(Grade(work_id=works[work].id, teacher_id=teacher.id, score=score, comment=comment,
                     created_at=_at(at)))
        if work in defense:
            # Вопросы сгенерированы до защиты, то есть раньше оценки.
            db.add(DefenseQuestions(work_id=works[work].id, questions=defense[work], edited_by_teacher=False,
                                    created_at=_at(at) - timedelta(hours=2)))
    db.commit()
