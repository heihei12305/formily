import { Tracker } from '@formily/reactive'
import { IObserverOptions } from '../types'
import { useForceUpdate } from './useForceUpdate'
import { useCompatFactory } from './useCompatFactory'

export const useObserver = <T extends () => any>(
  view: T,
  options?: IObserverOptions
): ReturnType<T> => {
  const forceUpdate = useForceUpdate()
  const tracker = useCompatFactory(
    () =>
      // 核心代码在这，触发 Tracker 的 scheduler 之后，会回调 forceUpdate，让组件刷新
      new Tracker(() => {
        if (typeof options?.scheduler === 'function') {
          options.scheduler(forceUpdate)
        } else {
          forceUpdate()
        }
      }, options?.displayName)
  )
  return tracker.track(view)
}
