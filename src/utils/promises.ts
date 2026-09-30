import {RpcError, RpcErrors} from "../rpc.js"

export async function adelay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Bound a stage by the same deadline as the remaining subscription transport work. */
export async function withDeadline<T>(work: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        const remaining = deadline - Date.now()
        if (remaining <= 0) reject(new RpcError(RpcErrors.Timeout, "Timeout"))
        else timer = setTimeout(() => reject(new RpcError(RpcErrors.Timeout, "Timeout")), remaining)
      }),
      work,
    ])
  } finally {
    clearTimeout(timer)
  }
}
