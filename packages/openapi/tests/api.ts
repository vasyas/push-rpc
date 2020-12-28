export interface Service {
  updateModel(req: {pk: number} & Partial<Model>, ctx?): Promise<void>
}

export interface Model {
  pk: number
  name: string
}
