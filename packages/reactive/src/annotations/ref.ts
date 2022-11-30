import { ProxyRaw, RawProxy } from '../environment'
import { createAnnotation } from '../internals'
import { buildDataTree } from '../tree'
import {
  bindTargetKeyWithCurrentReaction,
  runReactionsFromTargetKey,
} from '../reaction'

export interface IRef {
  <T>(target: T): { value: T }
}

/**
 * @description: 传入一个基本数据，内部数据会把这个 value 包成一个 store 从而调用defineProperty
 * * get 属于 baseHandlers 的简化版
 * * set 因为不存在对象 key 新增情况 也做了baseHandlers的简化
 * @param {*} createAnnotation
 * @return {*}
 */
export const ref: IRef = createAnnotation(({ target, key, value }) => {
  const store = {
    value: target ? target[key] : value,
  }

  const proxy = {}

  const context = target ? target : store
  const property = target ? key : 'value'

  function get() {
    bindTargetKeyWithCurrentReaction({
      target: context,
      key: property,
      type: 'get',
    })
    return store.value
  }

  function set(value: any) {
    const oldValue = store.value
    store.value = value
    if (oldValue !== value) {
      runReactionsFromTargetKey({
        target: context,
        key: property,
        type: 'set',
        oldValue,
        value,
      })
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
})
