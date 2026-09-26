---
title: Read models
description: Where read models are documented, and how the TypeScript client discovers, identifies, and returns read models.
sharedTopicBridge: true
---

Read models are shared Chronicle concepts. Querying, snapshots, watching, and consistency are documented in the shared Chronicle section.

- [Read models](/chronicle/read-models/)
- [Getting a single read model](/chronicle/read-models/getting-single-instance/)
- [Getting read model collections](/chronicle/read-models/getting-collection-instances/)
- [Watching read models](/chronicle/read-models/watching-read-models/)
- [TypeScript client setup](./getting-started.md)

Read models are discovered from `@projection('id', Model)`, `@reducer('id', sequenceId, Model)`, or an exported model with model-bound event mappings such as `@fromEvent(Event)` and `@setFrom(Event)`. The model type supplies the schema; its class name is the default Chronicle read-model identifier.

Use `@index()` on a read-model field to declare a single ascending, non-unique index. It works on models registered through projections, reducers, and model-bound mappings. The registration includes nested paths such as `lines.productId` when an indexed field belongs to a typed child collection; declare the element type with `@field(Array, { genericArguments: [Line] })`. The read-model key is indexed by the store already. The MongoDB sink creates indexes on registration, including when a container is rebuilt after replay; this does not add a general-purpose query API. See [Indexing read models](/chronicle/read-models/indexing/).

Queries fill every property the model declares from the stored read model. In this client, standard-decorated models whose mappings are only on properties register before construction if their classes are exported by discovered modules. With compiled JavaScript and no discovery patterns, add a class-level `@fromEvent(...)` or explicitly register the class before creating the event store; importing a property-only model alone is not enough. Legacy decorators still register property-only models on import. For unresolved standard mappings, store creation emits a diagnostic warning once per process with the mapped properties and event types grouped by class metadata; see [Artifact discovery](./getting-started.md#artifact-discovery) for registration options and how to enable diagnostic logging.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';

@eventType('order-placed')
class OrderPlaced {
    @field(Number) total!: number;
}

@fromEvent(OrderPlaced)
export class OrderSummary {
    @field(Number) total!: number;
}
```

For an existing model with a custom identifier, move the identifier to `static readonly readModelId = 'existing-id'` on the model before removing its deprecated `@readModel('existing-id')` decorator. The decorator remains supported for compatibility. Never change the identifier of a model with stored instances unless you plan a data migration. Two different model types with the same identifier fail registration rather than silently overwriting each other.

`store.readModels.getInstanceById(Model, key)` is the canonical read-by-key API, as in the .NET client. Its existing `Promise<Model>` signature does not signal absence: an empty kernel document produces a prototype-only model without populated fields, while a JSON `null` document can produce a model with constructor defaults. The .NET client instead returns `null` for a missing instance; changing this TypeScript behavior would break existing callers. Use `store.readModels.findInstanceById(Model, key)` when you need an explicit `Model | null` result and check for absence before using it. Both methods accept an optional session ID as their third argument.

Projections and reducers run after an append returns, so a read straight after an append can be missing or reflect older state. In scripts and tests, wait with `await appendResult.waitForCompletion()` first. In services, read the [eventual consistency](/chronicle/projections/eventual-consistency/) guidance.

For compliance-bearing reducer reads, both methods reject when PII release fails rather than returning an unreleased instance. Collection reads, snapshots, and watches also reject if compliance release fails.
