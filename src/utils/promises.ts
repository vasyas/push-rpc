export class PromiseCache {
  invoke<T>(cacheKey: unknown, supplier: () => Promise<T>): Promise<T> {
    const key = JSON.stringify(cacheKey)

    if (!this.cache[key]) {
      this.cache[key] = supplier()
        .then((r) => {
          delete this.cache[key]
          return r
        })
        .catch((e) => {
          delete this.cache[key]
          throw e
        })
    }

    return this.cache[key]
  }

  private cache: {[key: string]: Promise<any>} = {}
}
