---
title: Constraints in the TypeScript client
description: Where constraints are documented, and the TypeScript rules for naming, merging, messages, and releasing constraints declared with decorators.
sharedTopicBridge: true
---

Constraints are shared Chronicle behavior. The shared docs explain the consistency model and show TypeScript examples for each constraint style.

- [Constraints](/chronicle/constraints/)
- [Unique property values with decorators](/chronicle/constraints/model-bound/unique/)
- [Unique event types with decorators](/chronicle/constraints/model-bound/unique-event-type/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

- `@unique(name?, message?)` on an event property prevents another event source from claiming the same value. On an event class, it allows one occurrence of that event type per event source. Without a name, a property constraint uses the property name and a class constraint uses the class name.
- The client merges properties and classes that use the same constraint name into one definition, including across event types. For shared stores across languages and minified bundles, always give constraints explicit, stable names.
- Merged declarations must agree on scope, and decorated properties cannot merge with a case-insensitive fluent constraint. When declarations share a name, the first supplied message wins.
- TypeScript merges same-named unique-event-type declarations across fluent `uniqueFor` constraints and class-level `@unique` decorators. .NET does not: its fluent `Unique<T>(name: ...)` merges only within one `IConstraint`, and same-named class attributes produce separate definitions.
- A message replaces the kernel's default in append results; `{detailKey}` placeholders are replaced from violation details. Fluent `withMessage` messages also appear in append results.
- `@unique` has no ignore-casing option. Use the fluent `@constraint` class with `IConstraintBuilder.unique(...).ignoreCasing()` for case-insensitive matching. Both forms register the same way.
- Put a repeatable `@removeConstraint('Name')` on each event class that releases a constraint. The name must match exactly, one event can release several names, and derived event classes inherit the decorator. It can also release a fluent constraint with the same name.
- For a fluent `unique(...)` property constraint, the registered name is the `@constraint('Name')` id, even if you call `withName('OtherName')`. Use that id in `@removeConstraint`.
- Event classes need `@eventType`, and their modules must be imported or discovered before `getEventStore(...)`. The client registers constraints when it connects, and the kernel enforces them on append.
