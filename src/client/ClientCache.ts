export type ClientCache = {
  put(itemName: string, parameters: unknown[], value: unknown): void
  get(itemName: string, parameters: unknown[]): unknown | undefined
}
