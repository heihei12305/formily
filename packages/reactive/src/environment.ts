import { ObservableListener, Reaction, ReactionsMap } from './types'
import { ArraySet } from './array'
import { DataNode } from './tree'

export const ProxyRaw = new WeakMap() // key 是 proxy， value 是 普通源对象
export const RawProxy = new WeakMap() // key 是 普通源对象， value 是 proxy
export const RawShallowProxy = new WeakMap()
export const RawNode = new WeakMap<object, DataNode>() // key 是 proxy value 是 node
export const RawReactionsMap = new WeakMap<object, ReactionsMap>()

export const ReactionStack: Reaction[] = []
export const BatchCount = { value: 0 }
export const UntrackCount = { value: 0 }
export const BatchScope = { value: false }
export const DependencyCollected = { value: false }
export const PendingReactions = new ArraySet<Reaction>()
export const PendingScopeReactions = new ArraySet<Reaction>()
export const BatchEndpoints = new ArraySet<() => void>()
export const MakeObservableSymbol = Symbol('MakeObservableSymbol')
export const ObserverListeners = new ArraySet<ObservableListener>()
