---
title: Composite keys
description: Build TypeScript projection keys from event content, context, event source identifiers and constants.
---

When an event property alone does not identify a read-model instance, combine it with context or a fixed category. Each part of a TypeScript composite key uses the same set-expression builder as a projection property.

## Configure the parts

Inside a declarative projection, use `usingCompositeKey<TKey>()` for the instance key. `usingParentCompositeKey<TKey>()` emits a child's parent key, subject to the [kernel limitations below](#parent-and-join-keys). The following excerpt assumes the `CompositeRecordChanged`, `CompositeRecordKey` and read-model types in the [complete expression-parts example](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/client-snippets/projections/declarative/composite-keys/expression-parts.md):

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

The existing two-argument `set(target, eventAccessor)` remains available and can be mixed with the new form. Every `to` method returns the composite builder for chaining. Complete each one-argument `set` with a `to` method before building the projection; an unfinished part throws instead of emitting an invalid key. `toValue` requires the selected property's TypeScript type: a numeric part cannot take a string constant.

Setting the same target part twice now throws immediately, including when its first `set` is unfinished. This surfaces an invalid configuration earlier, matching .NET's duplicate-property check; the kernel's composite parser also rejects duplicates.

Context paths use TypeScript spelling, including `causedBy.subject`; the client emits CLR-cased paths such as `$eventContext(CausedBy.Subject)`. The syntax uses parentheses, not `$eventContext.Subject`. Constants use the same validation and serialization as other `toValue` mappings, including `$null` for null. Characters the kernel cannot parse in a constant, such as commas, are rejected.

The example emits:

```text
$composite(orderId=orderId,subject=$eventContext(Subject),sourceId=$eventSourceId,category=$value(orders))
```

## Parent and join keys

`usingParentCompositeKey` accepts the same expressions as the .NET client, but Chronicle 19.26.2 does not generally resolve composite parents. With a root `From` subscription and a parent key combining content, context and source id **without a constant**, the first child can be deferred even though its parent exists. The kernel searches for a parent event using the composite object's string representation, then falls back to looking for an existing child through `items.id`; neither locates that first child's parent. [Chronicle #551 tracks composite parent resolution](https://github.com/Cratis/Chronicle/issues/551). The client does not reject these definitions, preserving .NET parity.

A `$value(...)` part changes that path in 19.26.2: the kernel's unanchored constant-expression matcher classifies the entire composite parent expression as constant and bypasses parent-event lookup. The constant-bearing parent fixture succeeds through this shortcut, not through general composite-parent support. Do not rely on adding a constant as a supported workaround.

Chronicle 19.26.2 ignores custom **root** join keys: backfill and live updates still match the join event's source id ([Chronicle #4165](https://github.com/Cratis/Chronicle/issues/4165)). **Child** joins do resolve custom composite key expressions. Chronicle 19.26.2 uses the resolved child-join key as both the root document key and the child identifier, so a child join only updates children whose root has the same identifier ([Chronicle #4530](https://github.com/Cratis/Chronicle/issues/4530)). The oracle fixture deliberately uses matching composite root and child identifiers. Children are created through the `$value` parent-key shortcut; this fixture isolates child-join key evaluation, not parent resolution. A join's parent-key methods have no wire effect because `JoinDefinition` has no parent-key field.

The in-memory sink replaces the matched root state with the join changes. This is a Chronicle in-memory sink bug: root properties and sibling children are dropped ([Chronicle #4531](https://github.com/Cratis/Chronicle/issues/4531)), so in-memory results can differ from persistent storage.

## Testing boundary

The in-process `ReadModelScenario` evaluator still rejects composite instance, parent and join keys before replay. Use kernel-backed tests for these projections. The packaged projection oracle covers root keys, the constant-bearing parent shortcut, constant-free parent deferral, ignored root join keys and resolved child join keys. The deferral fixture captures an attempted `AddFuture` through the oracle's fail-closed futures guard, not a kernel exception or successful future storage. These fixtures do not prove persistent-sink behavior.

For the shared projection concepts and other clients, continue with the [Chronicle composite keys guide](/chronicle/projections/declarative/composite-keys/).
