import {
  batchEnd,
  batchStart,
  disposeBindingReactions,
  releaseBindingReactions,
  disposeEffects,
  hasDepsChange,
} from './reaction'
import { isFn } from './checkers'
import { ReactionStack } from './environment'
import { Reaction, IReactionOptions, Dispose } from './types'
import { toArray } from './array'

interface IValue {
  currentValue?: any
  oldValue?: any
}

export const autorun = (tracker: Reaction, name = 'AutoRun') => {
  const reaction: Reaction = () => {
    if (!isFn(tracker)) return
    if (reaction._boundary > 0) return // 避免反复触发 reaction
    if (ReactionStack.indexOf(reaction) === -1) {
      // 构造新的reaction时会把之前那个清理掉
      releaseBindingReactions(reaction)
      try {
        batchStart() // 使得 isBatching 为 true
        ReactionStack.push(reaction) // proxy handles 内部 会消费 ReactionStack 栈顶元素
        tracker() // 触发proxy get/set 函数
      } finally {
        ReactionStack.pop()
        reaction._boundary++ // 也许是上面用的 避免反复触发 reaction
        batchEnd()
        reaction._boundary = 0
        reaction._memos.cursor = 0
        reaction._effects.cursor = 0
      }
    }
  }
  const cleanRefs = () => {
    reaction._memos = {
      queue: [],
      cursor: 0,
    }
    reaction._effects = {
      queue: [],
      cursor: 0,
    }
  }
  reaction._boundary = 0
  reaction._name = name
  cleanRefs()
  reaction()
  return () => {
    disposeBindingReactions(reaction)
    disposeEffects(reaction)
    cleanRefs()
  }
}

/**
 * @description: 在 autorun 中用于创建持久引用数据，仅仅只会受依赖变化而重新执行 memo 内部函数
 * * 注意：请不要在 If/For 这类语句中使用，因为它内部是依赖执行顺序来绑定当前 autorun 的
 * @param {*} T
 * @param {any} dependencies
 * @return {*}
 */
autorun.memo = <T>(callback: () => T, dependencies?: any[]): T => {
  if (!isFn(callback)) return
  const current = ReactionStack[ReactionStack.length - 1]
  if (!current || !current._memos)
    throw new Error('autorun.memo must used in autorun function body.')
  const deps = toArray(dependencies || [])
  const id = current._memos.cursor++
  const old = current._memos.queue[id]
  if (!old || hasDepsChange(deps, old.deps)) {
    const value = callback()
    current._memos.queue[id] = {
      value,
      deps,
    }
    return value
  }
  return old.value
}

/**
 * @description: 在 autorun 中用于响应 autorun 第一次执行的下一个微任务时机与响应 autorun 的 dispose
 * * 注意：请不要在 If/For 这类语句中使用，因为它内部是依赖执行顺序来绑定当前 autorun 的
 * @param {function} callback
 * @param {any} dependencies
 * @return {*}
 */
autorun.effect = (callback: () => void | Dispose, dependencies?: any[]) => {
  if (!isFn(callback)) return
  const current = ReactionStack[ReactionStack.length - 1]
  if (!current || !current._effects)
    throw new Error('autorun.effect must used in autorun function body.')
  const effects = current._effects
  const deps = toArray(dependencies || [{}])
  const id = effects.cursor++
  const old = effects.queue[id]
  if (!old || hasDepsChange(deps, old.deps)) {
    Promise.resolve(0).then(() => {
      if (current._disposed) return
      const dispose = callback()
      if (isFn(dispose)) {
        effects.queue[id].dispose = dispose
      }
    })
    effects.queue[id] = {
      deps,
    }
  }
}

/**
 * @description: 大体流程跟autoRun一致 利用高阶函数 _scheduler 特性
 * * 接收一个 tracker 函数，与 callback 响应函数，如果 tracker 内部有消费 observable 数据，数据发生变化时，tracker 函数会重复执行，但是 callback 执行必须要求 tracker 函数返回值发生变化时才执行
 * @return {*}
 */
export const reaction = <T>(
  tracker: () => T,
  subscriber?: (value: T, oldValue: T) => void,
  options?: IReactionOptions<T>
) => {
  const realOptions = {
    name: 'Reaction',
    ...options,
  }
  const value: IValue = {}
  const dirtyCheck = () => {
    if (isFn(realOptions.equals))
      return !realOptions.equals(value.oldValue, value.currentValue)
    return value.oldValue !== value.currentValue
  }

  const fireAction = () => {
    try {
      //如果untrack的话，会导致用户如果在scheduler里同步调用setState影响下次React渲染的依赖收集
      batchStart()
      if (isFn(subscriber)) subscriber(value.currentValue, value.oldValue)
    } finally {
      batchEnd()
    }
  }

  const reaction: Reaction = () => {
    if (ReactionStack.indexOf(reaction) === -1) {
      releaseBindingReactions(reaction)
      try {
        ReactionStack.push(reaction)
        value.currentValue = tracker()
      } finally {
        ReactionStack.pop()
      }
    }
  }
  reaction._scheduler = (looping) => {
    looping()
    if (dirtyCheck()) fireAction()
    value.oldValue = value.currentValue
  }
  reaction._name = realOptions.name
  reaction()
  value.oldValue = value.currentValue
  if (realOptions.fireImmediately) {
    fireAction()
  }
  return () => {
    disposeBindingReactions(reaction)
  }
}
