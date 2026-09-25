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
- The model-bound `@childrenFrom`, `@nested`, and class- or property-level `@clearWith` decorators, and the matching fluent `.children()`/`.nested()` builders (plus `.addChild()`/`.setThisValue()` on `IFromBuilder`/`IJoinBuilder`).
- `.usingCompositeKey()`/`.usingParentCompositeKey()` on the fluent `IFromBuilder`/`IJoinBuilder`, for read models whose key is composed from more than one event property (see [Composite keys](/chronicle/projections/declarative/composite-keys/)).

Earlier client versions rejected these with a `not implemented yet.` error at registration. Upgrade the client if you still see it.

Two behaviors to know about in version 6.7.1:

- The kernel stores every property a projection maps, but the client's read-model queries only fill properties declared with `@field(Type)`. An undeclared property such as `title = '';` comes back with its default value. Add `@field(Type)` to every read-model property you read.
- `@setValue(Event, value)` and `.set(...).toValue(value)` do not write the constant to the read model. Map the value from an event property with `@setFrom` or `.to(...)` instead, or use a reducer.
