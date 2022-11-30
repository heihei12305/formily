import { RawNode, ProxyRaw } from './environment'
import { PropertyKey, IOperation } from './types'

/**
 * @description: 相当于一个闭包 保存 必要信息
 * @return {*}
 */
export class DataChange {
  node: DataNode
  key: PropertyKey
  object: object
  type: string
  value: any
  oldValue: any
  constructor(operation: IOperation, node: DataNode) {
    this.node = node
    this.key = operation.key
    this.type = operation.type
    this.object = operation.target
    this.value = operation.value
    this.oldValue = operation.oldValue
  }

  get path() {
    return this.node.path.concat(this.key)
  }
}
/**
 * @description:  DataNode 里面主要维护有 path，parent
 * @return {*}
 */
export class DataNode {
  target: any

  key: PropertyKey

  value: any

  constructor(target: any, key: PropertyKey, value: any) {
    this.target = target
    this.key = key
    this.value = value
  }

  get path() {
    if (!this.parent) return this.key ? [this.key] : []
    return this.parent.path.concat(this.key)
  }

  get targetRaw() {
    return ProxyRaw.get(this.target) || this.target
  }

  // TODO 搞清楚这个 parent 啥玩意
  get parent() {
    if (!this.target) return
    return getDataNode(this.targetRaw)
  }

  isEqual(node: DataNode) {
    if (this.key) {
      return node.targetRaw === this.targetRaw && node.key === this.key
    }
    return node.value === this.value
  }

  contains(node: DataNode) {
    if (node === this) return true
    let parent = node.parent
    while (!!parent) {
      if (this.isEqual(parent)) return true
      parent = parent.parent
    }
    return false
  }
}

/**
 * @description:  getDataNode 拿到的是 RawNode
 * @param {any} raw
 * @return {*}
 */
export const getDataNode = (raw: any) => {
  return RawNode.get(raw)
}

export const setDataNode = (raw: any, node: DataNode) => {
  RawNode.set(raw, node)
}

export const buildDataTree = (target: any, key: PropertyKey, value: any) => {
  const raw = ProxyRaw.get(value) || value
  const currentNode = getDataNode(raw)
  if (currentNode) return currentNode
  setDataNode(raw, new DataNode(target, key, value))
}
