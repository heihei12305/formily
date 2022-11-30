import { createBoundaryFunction } from './internals'
import { untrackStart, untrackEnd } from './reaction'

/**
 * @description: 用法与 batch 相似，在给定的 untracker 函数内部永远不会被依赖收集
 * * 与 action 比，没有批量能力
 * @return {*}
 */
export const untracked = createBoundaryFunction(untrackStart, untrackEnd)
