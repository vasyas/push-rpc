export type ExtractPromiseResult<Type> = Type extends Promise<infer X> ? X : never
