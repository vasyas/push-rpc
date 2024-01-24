export type ThrottleArgsReducer<D> = (prevValue: D, newValue: D) => D

export function lastValueReducer<D>(prevValue: D, newValue: D): D {
  return newValue
}

export function groupReducer<D>(prevValue: D[], newValue: D[]): D[] {
  if (!Array.isArray(newValue))
    throw new Error("groupReducer should only be used with topics that return arrays")

  return prevValue ? [...prevValue, ...newValue] : newValue
}

export function throttle<D>(
  callback: (d: D) => void,
  delay: number,
  reducer: ThrottleArgsReducer<D>
): (d: D) => void {
  let timer: NodeJS.Timeout
  let lastExec = 0

  let reducedArg: any

  function wrapper(this: any, d: D) {
    let self = this
    let elapsed = Date.now() - lastExec

    function exec() {
      lastExec = Date.now()
      callback.call(self, reducedArg)
      reducedArg = undefined
    }

    if (timer) {
      clearTimeout(timer)
    }

    reducedArg = reducer(reducedArg, d)

    if (elapsed > delay) {
      exec()
    } else {
      timer = setTimeout(exec, delay - elapsed)
    }
  }

  return wrapper
}
