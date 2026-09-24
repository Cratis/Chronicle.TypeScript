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

Use `store.readModels.findInstanceById(Model, key)` when the key may not exist. It returns `null` for an absent instance; check for absence before using the result. The optional third argument is a session ID.

`getInstanceById(Model, key)` is deprecated but retains its original `Promise<Model>` contract: for an absent instance it returns a prototype-only model without populated fields. Migrate to `findInstanceById` when you need to distinguish absence from stored data.

For compliance-bearing reducer reads, both methods reject when PII release fails rather than returning an unreleased instance. Collection reads, snapshots, and watches also reject if compliance release fails.
