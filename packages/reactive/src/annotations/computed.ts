import { ProxyRaw, RawProxy, ReactionStack } from '../environment'
import { createAnnotation } from '../internals'
import { buildDataTree } from '../tree'
import { isFn } from '../checkers'
import {
  bindTargetKeyWithCurrentReaction,
  runReactionsFromTargetKey,
  bindComputedReactions,
  hasRunningReaction,
  isUntracking,
  batchStart,
  batchEnd,
  releaseBindingReactions,
} from '../reaction'

interface IValue<T = any> {
  value?: T
}
export interface IComputed {
  <T>(compute: () => T): IValue<T>
  <T>(compute: { get?: () => T; set?: (value: T) => void }): IValue<T>
}

const getDescriptor = Object.getOwnPropertyDescriptor

const getProto = Object.getPrototypeOf

const ClassDescriptorMap = new WeakMap()

function getPropertyDescriptor(obj: any, key: PropertyKey) {
  if (!obj) return
  return getDescriptor(obj, key) || getPropertyDescriptor(getProto(obj), key)
}

function getPropertyDescriptorCache(obj: any, key: PropertyKey) {
  const constructor = obj.constructor
  if (constructor === Object || constructor === Array)
    return getPropertyDescriptor(obj, key)
  const cache = ClassDescriptorMap.get(constructor) || {}
  const descriptor = cache[key]
  if (descriptor) return descriptor
  const newDesc = getPropertyDescriptor(obj, key)
  ClassDescriptorMap.set(constructor, cache)
  cache[key] = newDesc
  return newDesc
}

function getPrototypeDescriptor(
  target: any,
  key: PropertyKey,
  value: any
): PropertyDescriptor {
  if (!target) {
    if (value) {
      if (isFn(value)) {
        return { get: value }
      } else {
        return value
      }
    }
    return {}
  }
  const descriptor = getPropertyDescriptorCache(target, key)
  if (descriptor) {
    return descriptor
  }
  return {}
}

export const computed: IComputed = createAnnotation(
  ({ target, key, value }) => {
    const store: IValue = {}

    const proxy = {}

    const context = target ? target : store
    const property = target ? key : 'value'
    const descriptor = getPrototypeDescriptor(target, property, value)

    function compute() {
      store.value = descriptor.get?.call(context)
    }
    function reaction() {
      if (ReactionStack.indexOf(reaction) === -1) {
        releaseBindingReactions(reaction)
        try {
          ReactionStack.push(reaction)
          compute()
        } finally {
          ReactionStack.pop()
        }
      }
    }
    reaction._name = 'ComputedReaction'
    reaction._scheduler = () => {
      // 当内部obersvable触发 scheduler 时 再次被设置为true
      reaction._dirty = true
      runReactionsFromTargetKey({
        target: context,
        key: property,
        value: store.value,
        type: 'set',
      })
    }
    reaction._isComputed = true
    reaction._dirty = true
    reaction._context = context
    reaction._property = property

    function get() {
      // 这么写好像是为了卸载的时候 清理内存
      if (hasRunningReaction()) {
        bindComputedReactions(reaction)
      }
      // 如果没有在不收集依赖
      if (!isUntracking()) {
        //如果允许untracked过程中收集依赖，那么永远不会存在绑定，因为_dirty已经设置为false
        // 只有内部依赖发生变化时，_dirty才会被重置为true 重复获取不会重复执行 compute
        if (reaction._dirty) {
          // 第一次执行时 _dirty 为 true
          reaction()
          // 后续设置为 false
          reaction._dirty = false
        }
      } else {
        compute()
      }
      bindTargetKeyWithCurrentReaction({
        target: context,
        key: property,
        type: 'get',
      })
      return store.value
    }

    function set(value: any) {
      try {
        batchStart()
        descriptor.set?.call(context, value)
      } finally {
        batchEnd()
      }
    }
    if (target) {
      Object.defineProperty(target, key, {
        get,
        set,
        enumerable: true,
      })
      return target
    } else {
      Object.defineProperty(proxy, 'value', {
        set,
        get,
      })
      buildDataTree(target, key, store)
      ProxyRaw.set(proxy, store)
      RawProxy.set(store, proxy)
    }
    return proxy
  }
)
