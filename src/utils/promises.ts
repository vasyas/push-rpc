export async function adelay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
