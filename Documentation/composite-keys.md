---
title: Composite keys
description: Build TypeScript projection keys from event content, context, event source identifiers and constants.
---

When an event property alone does not identify a read-model instance, combine it with context or a fixed category. Each part of a TypeScript composite key uses the same set-expression builder as a projection property.

## Configure the parts

Inside a declarative projection, use `usingCompositeKey<TKey>()` for the instance key or `usingParentCompositeKey<TKey>()` for a child's parent. The following excerpt assumes the `CompositeRecordChanged`, `CompositeRecordKey` and read-model types in the [complete expression-parts example](./client-snippets/projections/declarative/composite-keys/expression-parts.md):

```typescript
builder.from(CompositeRecordChanged, from => from
    .usingCompositeKey<CompositeRecordKey>(key => key
        .set(target => target.orderId, event => event.orderId)
        .set(target => target.subject).toEventContextProperty('subject')
        .set(target => target.sourceId).toEventSourceId()
        .set(target => target.category).toValue('orders')));
```

The event's order id, subject and source id determine the instance, while `orders` supplies a fixed category. Repeated events with those same values update the same instance; changing the subject or source id selects another instance.

| Part source | Configuration after `set(target)` | Wire expression |
| --- | --- | --- |
| Event property | `.to(event => event.orderId)` | `orderId` |
| Context property | `.toEventContextProperty('subject')` | `$eventContext(Subject)` |
| Event source id | `.toEventSourceId()` | `$eventSourceId` |
| Constant | `.toValue('orders')` | `$value(orders)` |

The existing two-argument `set(target, eventAccessor)` is unchanged and can be mixed with the new form. Every `to` method returns the composite builder for chaining. Complete each one-argument `set` with a `to` method before building the projection; an unfinished part throws instead of emitting an invalid key.

Context paths use TypeScript spelling, including `causedBy.subject`; the client emits CLR-cased paths such as `$eventContext(CausedBy.Subject)`. The syntax uses parentheses, not `$eventContext.Subject`. Constants use the same validation and serialization as other `toValue` mappings, including `$null` for null. Characters the kernel cannot parse in a constant, such as commas, are rejected.

The example emits:

```text
$composite(orderId=orderId,subject=$eventContext(Subject),sourceId=$eventSourceId,category=$value(orders))
```

## Parent and join keys

`usingParentCompositeKey` accepts the same part expressions, so children can select a parent whose identifier combines content and context. A join's `usingCompositeKey` also emits those expressions, matching the .NET client.

Chronicle 19.26.2 ignores custom root join keys when resolving joins: backfill and live updates still match the join event's source id. Emitting a composite join expression does not change that kernel behavior. A join's parent-key methods have no wire effect because `JoinDefinition` has no parent-key field.

## Testing boundary

The in-process `ReadModelScenario` evaluator still rejects composite instance, parent and join keys before replay. Use kernel-backed tests for these projections. The packaged projection oracle covers context and constant parts for root and parent keys and captures the custom-join-key limitation; it does not prove persistent-sink behavior.

For the shared projection concepts and other clients, continue with the [Chronicle composite keys guide](/chronicle/projections/declarative/composite-keys/).
