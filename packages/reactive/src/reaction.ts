import { isFn } from './checkers'
import { ArraySet } from './array'
import { IOperation, ReactionsMap, Reaction, PropertyKey } from './types'
import {
  ReactionStack,
  PendingScopeReactions,
  BatchEndpoints,
  DependencyCollected,
  RawReactionsMap,
  PendingReactions,
  BatchCount,
  UntrackCount,
  BatchScope,
  ObserverListeners,
} from './environment'

const ITERATION_KEY = Symbol('iteration key')

/**
 * @description:
 * * 这个是很重要的， proxy 触发时 通过 target 添加 react 到 RawReactionsMap > reactionsMap map
 * @return {*}
 */
const addRawReactionsMap = (
  target: any,
  key: PropertyKey,
  reaction: Reaction
) => {
  const reactionsMap = RawReactionsMap.get(target)
  if (reactionsMap) {
    const reactions = reactionsMap.get(key)
    if (reactions) {
      reactions.add(reaction)
    } else {
      reactionsMap.set(key, new ArraySet([reaction]))
    }
    return reactionsMap
  } else {
    const reactionsMap: ReactionsMap = new Map([
      [key, new ArraySet([reaction])],
    ])
    RawReactionsMap.set(target, reactionsMap)
    return reactionsMap
  }
}

/**
 * @description: 向 reaction _reactionsSet 里 添加
 *  * 添加这个好像只是为了清理内存
 * @return {*}
 */
const addReactionsMapToReaction = (
  reaction: Reaction,
  reactionsMap: ReactionsMap
) => {
  const bindSet = reaction._reactionsSet
  if (bindSet) {
    bindSet.add(reactionsMap)
  } else {
    reaction._reactionsSet = new ArraySet([reactionsMap])
  }
  return bindSet
}

const getReactionsFromTargetKey = (target: any, key: PropertyKey) => {
  const reactionsMap = RawReactionsMap.get(target)
  const reactions = []
  if (reactionsMap) {
    const map = reactionsMap.get(key)
    if (map) {
      map.forEach((reaction) => {
        if (reactions.indexOf(reaction) === -1) {
          reactions.push(reaction)
        }
      })
    }
  }
  return reactions
}
/**
 * @description: 累计 PendingReactions、PendingScopeReactions batchEnd触发 或者直接触发 reaction
 * @param {any} target
 * @param {PropertyKey} key
 * @return {*}
 */
const runReactions = (target: any, key: PropertyKey) => {
  const reactions = getReactionsFromTargetKey(target, key)
  const prevUntrackCount = UntrackCount.value
  UntrackCount.value = 0
  for (let i = 0, len = reactions.length; i < len; i++) {
    const reaction = reactions[i]
    if (reaction._isComputed) {
      reaction._scheduler(reaction)
    } else if (isScopeBatching()) {
      PendingScopeReactions.add(reaction)
    } else if (isBatching()) {
      PendingReactions.add(reaction)
    } else {
      if (isFn(reaction._scheduler)) {
        reaction._scheduler(reaction)
      } else {
        reaction()
      }
    }
  }
  UntrackCount.value = prevUntrackCount
}

const notifyObservers = (operation: IOperation) => {
  ObserverListeners.forEach((fn) => fn(operation))
}

/**
 * @description: 向 ReactionStack 栈顶 _reactionsSet 添加 当前 reaction
 * @param {IOperation} operation
 * @return {*}
 */
export const bindTargetKeyWithCurrentReaction = (operation: IOperation) => {
  let { key, type, target } = operation
  if (type === 'iterate') {
    key = ITERATION_KEY
  }

  const current = ReactionStack[ReactionStack.length - 1]
  if (isUntracking()) return
  if (current) {
    DependencyCollected.value = true
    // addRawReactionsMap 是最重要的
    addReactionsMapToReaction(current, addRawReactionsMap(target, key, current))
  }
}

export const bindComputedReactions = (reaction: Reaction) => {
  if (isFn(reaction)) {
    const current = ReactionStack[ReactionStack.length - 1]
    if (current) {
      const computes = current._computesSet
      if (computes) {
        computes.add(reaction)
      } else {
        current._computesSet = new ArraySet([reaction])
      }
    }
  }
}
/**
 * @description: 主要是handles里面使用，触发 runReactions
 * @param {IOperation} operation
 * @return {*}
 */
export const runReactionsFromTargetKey = (operation: IOperation) => {
  let { key, type, target, oldTarget } = operation
  batchStart()
  notifyObservers(operation)
  if (type === 'clear') {
    oldTarget.forEach((_: any, key: PropertyKey) => {
      runReactions(target, key)
    })
  } else {
    runReactions(target, key)
  }
  if (type === 'add' || type === 'delete' || type === 'clear') {
    const newKey = Array.isArray(target) ? 'length' : ITERATION_KEY
    runReactions(target, newKey)
  }
  batchEnd()
}

export const hasRunningReaction = () => {
  return ReactionStack.length > 0
}

export const releaseBindingReactions = (reaction: Reaction) => {
  reaction._reactionsSet?.forEach((reactionsMap) => {
    reactionsMap.forEach((reactions) => {
      reactions.delete(reaction)
    })
  })
  PendingReactions.delete(reaction)
  PendingScopeReactions.delete(reaction)
  delete reaction._reactionsSet
}

export const suspendComputedReactions = (current: Reaction) => {
  current._computesSet?.forEach((reaction) => {
    const reactions = getReactionsFromTargetKey(
      reaction._context,
      reaction._property
    )
    if (reactions.length === 0) {
      disposeBindingReactions(reaction)
      reaction._dirty = true
    }
  })
}

export const disposeBindingReactions = (reaction: Reaction) => {
  reaction._disposed = true
  releaseBindingReactions(reaction)
  suspendComputedReactions(reaction)
}

export const batchStart = () => {
  BatchCount.value++
}

export const batchEnd = () => {
  BatchCount.value--
  if (BatchCount.value === 0) {
    const prevUntrackCount = UntrackCount.value
    UntrackCount.value = 0
    executePendingReactions() // 批量触发 reactions 执行
    executeBatchEndpoints() // endpoint 会设置 BatchEndpoints，在这里释放
    UntrackCount.value = prevUntrackCount
  }
}

export const batchScopeStart = () => {
  BatchScope.value = true
}

export const batchScopeEnd = () => {
  const prevUntrackCount = UntrackCount.value
  BatchScope.value = false
  UntrackCount.value = 0
  PendingScopeReactions.batchDelete((reaction) => {
    if (isFn(reaction._scheduler)) {
      reaction._scheduler(reaction)
    } else {
      reaction()
    }
  })
  UntrackCount.value = prevUntrackCount
}

export const untrackStart = () => {
  UntrackCount.value++
}

export const untrackEnd = () => {
  UntrackCount.value--
}

export const isBatching = () => BatchCount.value > 0

export const isScopeBatching = () => BatchScope.value

export const isUntracking = () => UntrackCount.value > 0

export const executePendingReactions = () => {
  PendingReactions.batchDelete((reaction) => {
    if (isFn(reaction._scheduler)) {
      reaction._scheduler(reaction)
    } else {
      reaction()
    }
  })
}

export const executeBatchEndpoints = () => {
  BatchEndpoints.batchDelete((callback) => {
    callback()
  })
}

export const hasDepsChange = (newDeps: any[], oldDeps: any[]) => {
  if (newDeps === oldDeps) return false
  if (newDeps.length !== oldDeps.length) return true
  if (newDeps.some((value, index) => value !== oldDeps[index])) return true
  return false
}

export const disposeEffects = (reaction: Reaction) => {
  if (reaction._effects) {
    try {
      batchStart()
      reaction._effects.queue.forEach((item) => {
        if (!item || !item.dispose) return
        item.dispose()
      })
    } finally {
      batchEnd()
    }
  }
}
