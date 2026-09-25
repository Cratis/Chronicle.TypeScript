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

Queries fill every property the model declares from the stored read model. With standard decorators, a model with only property decorators and no class-level `@fromEvent` registers once an instance of it exists; give it `@fromEvent(...)` so it registers when its module loads. See [Artifact discovery](./getting-started.md#artifact-discovery).

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

Use `store.readModels.findInstanceById(Model, key)` when the key may not exist. It returns `null` for an absent instance; check for absence before using the result. The optional third argument is a session ID.

Projections and reducers run after an append returns, so a read straight after an append can return `null` or older state. In scripts and tests, wait with `await appendResult.waitForCompletion()` first. In services, read the [eventual consistency](/chronicle/projections/eventual-consistency/) guidance.

`getInstanceById(Model, key)` is deprecated but retains its original `Promise<Model>` contract: for an absent instance it returns a prototype-only model without populated fields. Migrate to `findInstanceById` when you need to distinguish absence from stored data.

For compliance-bearing reducer reads, both methods reject when PII release fails rather than returning an unreleased instance. Collection reads, snapshots, and watches also reject if compliance release fails.
