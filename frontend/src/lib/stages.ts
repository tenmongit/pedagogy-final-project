import { STAGES, type Stage } from '@/api/types'

export type StageState = 'done' | 'current' | 'todo'

export function stageState(stage: Stage, current: Stage): StageState {
  const i = STAGES.indexOf(stage)
  const c = STAGES.indexOf(current)
  return i < c ? 'done' : i === c ? 'current' : 'todo'
}
