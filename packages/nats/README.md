Push-RPC using NATS.

## Subject structure.

1. Call method or get topic data. Request on
```
<service name>.rpc-call.<topic/method name, using / as separator>
```

2. Push data

```
<service name>.rpc-data.<topic/method name>.<filter1>.<filter2>....
```

## Notes on Topic subscription

Filter fields are used to limit number of messages deivered to a topic.
So when subscribing to a topic, specify all possible fields in a filter.
If some of the fields are empty, pass null.
