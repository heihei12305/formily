import { createAnnotation, createObservable } from '../internals'
import {
  bindTargetKeyWithCurrentReaction,
  runReactionsFromTargetKey,
} from '../reaction'
import { IObservable } from './observable'

/**
 * @description: 创建浅劫持响应式对象，也就是只会对目标对象的第一级属性操作响应
 * @return {*}
 */
export const shallow: IObservable = createAnnotation(
  ({ target, key, value }) => {
    const store = {
      value: createObservable(target, key, target ? target[key] : value, true),
    }

    function get() {
      bindTargetKeyWithCurrentReaction({
        target: target,
        key: key,
        type: 'get',
      })
      return store.value
    }

    function set(value: any) {
      const oldValue = store.value
      value = createObservable(target, key, value, true)
      store.value = value
      if (oldValue === value) return
      runReactionsFromTargetKey({
        target: target,
        key: key,
        type: 'set',
        oldValue,
        value,
      })
    }
    if (target) {
      Object.defineProperty(target, key, {
        set,
        get,
        enumerable: true,
        configurable: false,
      })
      return target
    }
    return store.value
  }
)
