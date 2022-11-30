import { IOperation } from './types'
import { ProxyRaw, ObserverListeners } from './environment'
import { isFn } from './checkers'
import { DataChange, getDataNode } from './tree'

/**
 * @description: 与 autorun/reaction/Tracker 非常不一样，使用 observe 会监听 observable 对象的所有操作，支持深度监听也支持浅监听
 * * 读取操作是不会被监听到的
 * * 这个玩意是全局的，感觉不要多用
 * @return {*}
 */
export const observe = (
  target: object,
  observer?: (change: DataChange) => void,
  deep = true
) => {
  const addListener = (target: any) => {
    const raw = ProxyRaw.get(target) || target
    const node = getDataNode(raw)

    const listener = (operation: IOperation) => {
      const targetRaw = ProxyRaw.get(operation.target) || operation.target
      const targetNode = getDataNode(targetRaw)
      if (deep) {
        if (node.contains(targetNode)) {
          observer(new DataChange(operation, targetNode))
          return
        }
      }
      if (
        node === targetNode ||
        (node.targetRaw === targetRaw && node.key === operation.key)
      ) {
        observer(new DataChange(operation, targetNode))
      }
    }

    if (node && isFn(observer)) {
      ObserverListeners.add(listener)
    }
    return () => {
      ObserverListeners.delete(listener)
    }
  }
  if (target && typeof target !== 'object')
    throw Error(`Can not observe ${typeof target} type.`)
  return addListener(target)
}
