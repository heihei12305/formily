import {
  batchStart,
  batchEnd,
  batchScopeStart,
  batchScopeEnd,
  untrackStart,
  untrackEnd,
} from './reaction'
import { createBoundaryAnnotation } from './internals'
import { IAction } from './types'

/**
 * @description: 定义一个批量动作。与 batch 的唯一差别就是 action 内部是无法收集依赖的
 * * Observable 元素 会对相同 reaction 进行去重，多次设置只会取一次
 * @return {*}
 */
export const action: IAction = createBoundaryAnnotation(
  () => {
    batchStart()
    untrackStart() // 多了这个
  },
  () => {
    untrackEnd()
    batchEnd()
  }
)

action.scope = createBoundaryAnnotation(
  () => {
    batchScopeStart()
    untrackStart()
  },
  () => {
    untrackEnd()
    batchScopeEnd()
  }
)
