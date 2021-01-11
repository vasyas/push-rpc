export interface DataFilter extends Record<string, any> {}

export type DataConsumer<DataType> = (data: DataType) => void

export interface RemoteTopic<DataType, FilterType extends DataFilter> {
  subscribe(
    consumer: DataConsumer<DataType>,
    filter?: FilterType,
    subscriptionKey?: any
  ): Promise<any>

  unsubscribe(params?: FilterType, subscriptionKey?: any)

  get(params?: FilterType): Promise<DataType>
}

export type DataSupplier<DataType, FilterType extends DataFilter> = (
  filter: FilterType,
  ctx
) => Promise<DataType>

export interface LocalTopic<DataType, FilterType, TriggerDataType = DataType> {
  trigger(filter?: Partial<FilterType>, data?: TriggerDataType): void
}

export interface Topic<DataType, FilterType extends DataFilter = {}, TriggerDataType = DataType>
  extends RemoteTopic<DataType, FilterType>,
    LocalTopic<DataType, FilterType, TriggerDataType> {}
