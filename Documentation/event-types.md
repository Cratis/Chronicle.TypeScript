---
sharedTopicBridge: true
---

# Event Types

Event types are a shared Chronicle concept. Use the shared documentation for the model, naming rules, generations, and schema evolution flow.

- [Event type concept](/chronicle/concepts/event-type/)
- [Events and event logs](/chronicle/events/)
- [Event evolution](/chronicle/understanding-event-evolution/)
- [TypeScript client setup](./getting-started.md)

In standard and legacy decorator modes, use a `@field(Type)` instance field and a constructor that assigns it when you want `new Event(value)`. Do not decorate a constructor parameter: the field supplies the runtime schema type, while the constructor makes creation convenient. Keep constructors safe to call without arguments so schema inspection and deserialization can construct the class. See the [setup example](./getting-started.md#decorator-mode-and-schema-types).

When you configure `ChronicleOptions` with `clientArtifactsProvider`, the store uses that catalog for discovery, registration, and schema validation instead of the global default provider.

`isRegisteredEvent(store, value)` narrows an unknown value to an object only if it is an instance of a decorated, current-generation event type in that store's discovered catalog. A decorated type that is not in `store.eventTypes.all` returns `false`; call it after artifact discovery. This helps distinguish command responses from events without classifying every object as an event.
