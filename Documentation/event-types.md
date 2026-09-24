---
sharedTopicBridge: true
---

# Event Types

Event types are a shared Chronicle concept. Use the shared documentation for the model, naming rules, generations, and schema evolution flow.

- [Event type concept](/chronicle/concepts/event-type/)
- [Events and event logs](/chronicle/events/)
- [Event evolution](/chronicle/understanding-event-evolution/)
- [TypeScript client setup](./getting-started.md)

When you configure `ChronicleOptions` with `clientArtifactsProvider`, the store uses that catalog for discovery, registration, and schema validation instead of the global default provider.

`isRegisteredEvent(store, value)` narrows an unknown value to an object only if it is an instance of a decorated, current-generation event type in that store's discovered catalog. A decorated type that is not in `store.eventTypes.all` returns `false`; call it after artifact discovery. This helps distinguish command responses from events without classifying every object as an event.
