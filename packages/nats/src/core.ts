import {DataSupplier, DataConsumer, LocalTopic, RemoteTopic, Topic} from "../../core/src"
export {DataSupplier, DataConsumer, LocalTopic, RemoteTopic, Topic}

export type Method = (req?, ctx?) => Promise<any>
export type ServiceItem =
  | {method: Method; object: any}
  | {topic: LocalTopic<never, never>; object: any}
