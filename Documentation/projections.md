---
title: Projections
description: Projections are documented in the shared Chronicle docs; this page lists what the TypeScript client supports.
sharedTopicBridge: true
---

Projections are shared Chronicle read-model behavior. Use the shared docs for projection styles, model-bound projections, declarative projections, and client-tabbed examples.

- [Projections](/chronicle/projections/)
- [Choosing a read model style](/chronicle/projections/choosing-a-read-model-style/)
- [Model-bound projections](/chronicle/projections/model-bound/)
- [Declarative projections](/chronicle/projections/declarative/)
- [Composite keys](/chronicle/projections/declarative/composite-keys/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

The TypeScript client supports these projection capabilities, in addition to `@fromEvent`, `@setFrom`, and the declarative `.from(...)` builder:

- The model-bound arithmetic decorators — `@addFrom`, `@subtractFrom`, `@increment`, `@decrement`, `@count` — and their fluent equivalents (`.add()`/`.subtract()`/`.count()` on `IFromBuilder`/`IJoinBuilder`).
- The model-bound `@childrenFrom`, `@nested`, and class- or property-level `@clearWith` decorators, and the matching fluent `.children()`/`.nested()` builders (plus `.addChild()`/`.setThisValue()` on `IFromBuilder`/`IJoinBuilder`). On a scalar member of a root, child, or nested type, `@clearWith(Event)` maps that member to `$null` in the event's `From` entry. On a nested type or the member carrying `@nested`, it clears the whole nested object instead.
- Constant values with `@setValue(Event, value)` and `.set(...).toValue(value)`, and constant keys. Earlier client versions sent these in a form the kernel did not apply, so the read model kept its previous value.
- Event-context mappings with `@setFromContext(Event, 'occurred')`, `.set(...).toEventContextProperty('occurred')`, and context-derived keys with `.usingKeyFromContext('eventSourceId')` or `.usingParentKeyFromContext('eventSourceId')`. These names use the TypeScript `EventContext` spelling; the client sends `$eventContext(Occurred)` and `$eventContext(EventSourceId)` to the kernel. Earlier client versions sent expressions the kernel did not recognize, or treated model-bound context names as event-content properties.
- `.usingCompositeKey()`/`.usingParentCompositeKey()` on the fluent `IFromBuilder`/`IJoinBuilder`, for read models whose key is composed from more than one event property (see [Composite keys](/chronicle/projections/declarative/composite-keys/)).

Earlier client versions rejected these with a `not implemented yet.` error at registration. Upgrade the client if you still see it.

Under runtimes that emit no type metadata, such as `tsx`, name the child type of a children collection in `@childrenFrom(ItemAdded, Item, 'itemId')`: the second argument can be the child class instead of the key. The client then excludes `Item` from the root read models and restores the collection as `Item` instances.

With standard decorators, a model-bound read model whose mappings are all on properties registers only once an instance of it exists. Give it a class-level `@fromEvent(...)` decorator so it registers when its module loads.
