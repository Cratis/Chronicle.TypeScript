---
sharedTopicBridge: true
---

# Read Models

Read models are shared Chronicle concepts. Querying, snapshots, watching, and consistency are documented in the shared Chronicle section.

- [Read models](/chronicle/read-models/)
- [Getting a single read model](/chronicle/read-models/getting-single-instance/)
- [Getting read model collections](/chronicle/read-models/getting-collection-instances/)
- [Watching read models](/chronicle/read-models/watching-read-models/)
- [TypeScript client setup](./getting-started.md)

Read models are discovered from `@projection('id', Model)`, `@reducer('id', sequenceId, Model)`, or an exported model with model-bound event mappings such as `@fromEvent(Event)` and `@setFrom(Event)`. The model type supplies the schema; its class name remains the default Chronicle read-model identifier. Use `static readonly readModelId = 'existing-id'` on the model to preserve a custom identifier without an extra class decorator. `@readModel('existing-id')` still works but is deprecated; remove it after moving any custom identifier to `readModelId`. Never change the identifier of a model with stored instances unless you plan a data migration. Two different model types with the same identifier fail registration rather than silently overwriting each other. Export property-only model-bound classes from discovered modules so the client can find them.

Use `store.readModels.findInstanceById(Model, key)` when the key may not exist. It returns `null` for an absent instance; check for absence before using the result. The optional third argument is a session ID.

`getInstanceById(Model, key)` is deprecated but retains its original `Promise<Model>` contract: for an absent instance it returns a prototype-only model without populated fields. Migrate to `findInstanceById` when you need to distinguish absence from stored data.

For compliance-bearing reducer reads, both methods reject when PII release fails rather than returning an unreleased instance. Collection reads, snapshots, and watches also reject if compliance release fails.
