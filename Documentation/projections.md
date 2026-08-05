---
sharedTopicBridge: true
---

# Projections

Projections are shared Chronicle read-model behavior. Use the shared docs for projection styles, model-bound projections, declarative projections, and client-tabbed examples.

- [Projections](/chronicle/projections/)
- [Choosing a read model style](/chronicle/projections/choosing-a-read-model-style/)
- [Model-bound projections](/chronicle/projections/model-bound/)
- [Declarative projections](/chronicle/projections/declarative/)
- [Composite keys](/chronicle/projections/declarative/composite-keys/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

Several projection capabilities that previously threw `not implemented yet.` at registration time now work end to end:

- The model-bound arithmetic decorators — `@addFrom`, `@subtractFrom`, `@increment`, `@decrement`, `@count` — and their fluent equivalents (`.add()`/`.subtract()`/`.count()` on `IFromBuilder`/`IJoinBuilder`).
- The model-bound `@childrenFrom`, `@nested`, and class- or property-level `@clearWith` decorators, and the matching fluent `.children()`/`.nested()` builders (plus `.addChild()`/`.setThisValue()` on `IFromBuilder`/`IJoinBuilder`).
- `.usingCompositeKey()`/`.usingParentCompositeKey()` on the fluent `IFromBuilder`/`IJoinBuilder`, for read models whose key is composed from more than one event property (see [Composite keys](/chronicle/projections/declarative/composite-keys/)).

If you tried any of these before and hit a `not implemented yet.` error, they are safe to use now.
