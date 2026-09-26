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
- Event-context mappings with `@setFromContext(Event, 'occurred')`, `.set(...).toEventContextProperty('occurred')`, and context-derived keys with `.usingKeyFromContext('eventSourceId')` or `.usingParentKeyFromContext('eventSourceId')`, including inside `.addChild(model => model.children, child => child.identifiedBy(item => item.id).usingKeyFromContext('sequenceNumber').usingParentKeyFromContext('eventSourceId'))`. In the accessor form of `.addChild(model => model.children, event => event.property)`, the builder names `identifiedBy`, `usingKey`, `usingKeyFromContext` and `usingParentKeyFromContext` are reserved and can't be selected as event properties. These names use the TypeScript `EventContext` spelling; the client sends `$eventContext(Occurred)` and `$eventContext(EventSourceId)` to the kernel. Registration accepts only paths the kernel can resolve: any root `EventContext` property; an identity member of `causedBy` (`subject`, `name`, `userName`), or `causedBy.onBehalfOf` as a whole identity; and `occurred.week()`, the kernel's only derived function, emitted as `Occurred.Week()`. `causation` and `tags` are collections, so they can be mapped only as a whole. Anything else fails during projection registration, naming the projection, read model and invalid path. The error's cause is `InvalidEventContextPropertyError`, exported from `@cratis/chronicle` and `@cratis/chronicle/projections`. Earlier client versions sent expressions the kernel did not recognize, or treated model-bound context names as event-content properties.
- `.usingCompositeKey()`/`.usingParentCompositeKey()` on the fluent `IFromBuilder`/`IJoinBuilder`, for read models whose key is composed from more than one event property (see [Composite keys](/chronicle/projections/declarative/composite-keys/)).

Earlier client versions rejected these with a `not implemented yet.` error at registration. Upgrade the client if you still see it.

For model-bound `@childrenFrom`, an automatically mapped child whose identifier is a discoverable `id`/`Id`, or supplied as `identifiedBy`, gets its identifier from `$eventContext(EventSourceId)` when the child key defaults to the event source id. An explicit event key instead maps to that event property unless it already matches the identifier name; if no `id` is found, a child property matching the event key becomes `IdentifiedBy`. TypeScript has no `[Key]` decorator: pass `identifiedBy` for a differently named identifier, and use an initialized property or `@field` so convention-based `id`/`Id` is discoverable at runtime. Explicit identifier mappings and class-level `@noAutoMap` on the child or its declaring class take precedence; property-level `@noAutoMap` on the identifier does not suppress this default identifier mapping. Creating events with non-empty mappings consisting only of aggregate expressions (`@count`, `@increment`, `@decrement`, `@addFrom`, `@subtractFrom`) do not get the identifier mapping: the kernel initializes the child identifier from the resolved key, and leaving those mappings aggregate-only prevents unrelated same-named event properties from being AutoMapped onto the child.

For existing apps with model-bound children, this changes two behaviors: an automatically mapped identifier now comes from the event source id rather than an AutoMapped same-named event property when the child key is implicit, and a child without `id` whose property matches an explicit event key now uses that property as `IdentifiedBy`. When `@count`, `@increment` or `@decrement` give an aggregate-only creating event a constant key, the kernel initializes the identifier from that constant (`$value(...)`), the key it uses to find the child. The .NET model-bound builder instead adds an explicit identifier mapping from the event source id for the default child key, even for aggregate-only events. Replaying affected events with the new definitions can produce different persisted child data; check those read models when upgrading.

Under runtimes that emit no type metadata, such as `tsx`, name the child type of a children collection in `@childrenFrom(ItemAdded, Item, 'itemId')`: the second argument can be the child class instead of the key. The client then excludes `Item` from the root read models and restores the collection as `Item` instances.

With standard decorators, a model-bound read model whose mappings are all on properties registers only once an instance of it exists. Give it a class-level `@fromEvent(...)` decorator so it registers when its module loads.

Projection registration computes `LastUpdated` from the full definition, including nested mappings. After upgrading, this value changes once for every projection. The Chronicle kernel's `ProjectionDefinitionComparer` excludes `LastUpdated`, `ReadModel`, and `InitialModelState` before comparing definitions (and normalizes optional collections). A changed `LastUpdated` alone therefore does not trigger a replay; changed child mappings or `IdentifiedBy` are part of the comparison.
