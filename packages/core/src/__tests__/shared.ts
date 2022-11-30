/**
 * @description: 将传入的 target 调用一下 onMount 函数
 * @param {*} T
 * @return {*}
 */
export const attach = <T extends { onMount: () => void }>(target: T): T => {
  target.onMount()
  return target
}

export const sleep = (duration = 100) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
