import { isFn, isStr, each } from '@formily/shared'
import { LifeCycleHandler, LifeCyclePayload } from '../types'

type LifeCycleParams<Payload> = Array<
  | string
  | LifeCycleHandler<Payload>
  | { [key: string]: LifeCycleHandler<Payload> }
>
export class LifeCycle<Payload = any> {
  private listener: LifeCyclePayload<Payload>

  constructor(...params: LifeCycleParams<Payload>) {
    this.listener = this.buildListener(params)
  }
  /**
   * @description: 过于离谱 无法理解 看这个结构好像是
   * * 如果是函数就直接扔进去自己处理，
   * * 如果是字符串+函数 就判断一下，如果是这个 type 再进行回调
   * @param {any} params
   * @return {*}
   */
  buildListener = (params: any[]) => {
    return function (payload: { type: string; payload: Payload }, ctx: any) {
      for (let index = 0; index < params.length; index++) {
        let item = params[index]
        if (isFn(item)) {
          item.call(this, payload, ctx)
        } else if (isStr(item) && isFn(params[index + 1])) {
          if (item === payload.type) {
            params[index + 1].call(this, payload.payload, ctx)
          }
          index++
        } else {
          each<any, any>(item, (handler, type) => {
            if (isFn(handler) && isStr(type)) {
              if (type === payload.type) {
                handler.call(this, payload.payload, ctx)
                return false
              }
            }
          })
        }
      }
    }
  }

  notify = <Payload>(type: any, payload?: Payload, ctx?: any) => {
    if (isStr(type)) {
      this.listener.call(ctx, { type, payload }, ctx)
    }
  }
}
