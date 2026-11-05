---
title: Event types
description: Where event types are documented, and how to declare TypeScript event classes so Chronicle can build their schemas.
sharedTopicBridge: true
---

Before you append an event such as `OrderPlaced`, declare its runtime schema and make the class available to your event store. TypeScript's property types do not supply that schema at runtime. The [TypeScript client setup](./getting-started.md) shows how to declare and discover event classes; the shared [event type concept](/chronicle/concepts/event-type/) explains what belongs in an event.

Mark the event class with `@eventType()`. In standard and legacy decorator modes, put `@field(Type)` on each instance field whose runtime schema type Chronicle needs. If you want to construct the event with `new Event(value)`, add a constructor that assigns that field. Do not decorate the constructor parameter: the field supplies the runtime schema type, while the constructor makes creation convenient. Name each constructor parameter after the field it assigns; in standard mode a differently named parameter fails schema generation. Keep constructors safe to call without arguments, because schema inspection and deserialization also construct the class. See [Decorator mode and schema types](./getting-started.md#decorator-mode-and-schema-types) for the supported declarations.

A declaration still has to reach the store's artifact catalog. Follow [Artifact discovery](./getting-started.md#artifact-discovery) for the modules your program actually loads. When you configure `ChronicleOptions` with `clientArtifactsProvider`, the store uses that catalog for discovery, registration, and schema validation instead of the global default provider. Decorating a class does not put it in every store.

If you need to distinguish an event from an arbitrary command response, call `isRegisteredEvent(store, value)` after discovery. It narrows an unknown value to an object only when the value is an instance of a decorated, current-generation event type in that store's discovered catalog. A decorated type absent from `store.eventTypes.all` returns `false`.

Once the type is registered, [append an instance to the event log](./event-log.md) and check the append result. Registration describes what Chronicle can store; it is not evidence that an event was accepted. [Events and event logs](/chronicle/events/) explains where those instances live. When the event's shape needs to change, follow [Event evolution](/chronicle/understanding-event-evolution/) for naming, generations, and schema changes rather than treating a new class definition as a migration.

To declare an event as a compensation for another event type, add `@compensationFor(OriginalEvent)` next to `@eventType()`, for example `@eventType() @compensationFor(EntryPosted) class EntryReversed { ... }`. Chronicle registers the link with the event type's schema, and a compensation event type can compensate for one event type. Append it with [`eventLog.compensate`](./event-log.md). Observers receive the compensated sequence number as `context.compensationFor`, which is `undefined` for events that are not compensations. See [Event compensation](/chronicle/events/compensation/).
