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
- Apply `@noAutoMap` to a child or nested class to disable automatic property mapping for that definition; a decorated declaring class also disables it for its direct child and nested definitions (the policy does not cascade further). Apply `@noAutoMap` to individual properties on child or nested types to exclude just those members from automatic mapping. Explicit `@setFrom` mappings still apply. Fluent child and nested builders support `.noAutoMap()` and `.autoMap()`.
- Constant values with `@setValue(Event, value)` and `.set(...).toValue(value)`, and constant keys. Earlier client versions sent these in a form the kernel did not apply, so the read model kept its previous value.
- `.usingCompositeKey()`/`.usingParentCompositeKey()` on the fluent `IFromBuilder`/`IJoinBuilder`, for read models whose key is composed from more than one event property (see [Composite keys](/chronicle/projections/declarative/composite-keys/)).

Earlier client versions rejected these with a `not implemented yet.` error at registration. Upgrade the client if you still see it.

Under runtimes that emit no type metadata, such as `tsx`, name the child type of a children collection in `@childrenFrom(ItemAdded, Item, 'itemId')`: the second argument can be the child class instead of the key. The client then excludes `Item` from the root read models and restores the collection as `Item` instances.

With standard decorators, a model-bound read model whose mappings are all on properties registers only once an instance of it exists. Give it a class-level `@fromEvent(...)` decorator so it registers when its module loads.

Projection registration computes `LastUpdated` from the full definition, including nested mappings. After upgrading, this value changes once for every projection. The kernel compares definitions structurally and treats `LastUpdated` as metadata only, so the new value alone does not trigger a replay.
