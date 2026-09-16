---
title: Preserve existing append routes
description: Keep writing to existing TypeScript streams when upgrading to kernel-owned append routing.
---

The move to kernel-owned append routing is a **major change** for the TypeScript client. Previously, an append with no route options sent source type `Default`, stream type `Default`, and the event source identifier as the stream identifier. The client now omits unspecified route dimensions. A kernel supporting the new behavior resolves missing or empty dimensions to source type `Default`, stream type `All`, and stream identifier `Default`.

## Before upgrading

Use this guide when you must continue an existing stream rather than select the new kernel defaults. Upgrade the kernel and client together after the receipt-capable contracts release is available. Do not deploy the intermediate client changes against an older kernel: descriptor compatibility alone cannot certify a semantic routing change.

The client checks its installed contracts descriptor before connection succeeds and before event-sequence operations, including direct append calls. An incompatible server or an unavailable compatibility endpoint prevents writes. It checks again for each replacement channel.

## Make existing routes explicit

Pass all three legacy dimensions when appending to an existing stream. The event source argument still selects the source; the reserved `AppendOptions.eventSourceId` property does not override it.

```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class LegacyOrderNoteRecorded {
    constructor(readonly note: string) {}
}

async function appendToExistingOrder(log: IEventLog, orderId: string, note: string) {
    return log.append(orderId, new LegacyOrderNoteRecorded(note), {
        sourceType: 'Default',
        streamType: 'Default',
        streamId: orderId
    });
}

async function appendToExistingOrders(log: IEventLog, orderIds: string[], note: string) {
    return log.appendMany(orderIds.map(orderId => ({
        eventSourceId: orderId,
        event: new LegacyOrderNoteRecorded(note),
        eventSourceType: 'Default',
        eventStreamType: 'Default',
        eventStreamId: orderId
    })));
}
```

For a batch containing different sources, set each entry's `eventStreamId` to that entry's source identifier. A shared `streamId` would target the same stream identifier for every entry.

## Review metadata overrides

Shared `AppendOptions` accept `sourceType`, `streamType`, `streamId`, `subject`, and `occurred` (`Date`). Rich `EventForEventSourceId` entries use `eventSourceType`, `eventStreamType`, `eventStreamId`, `subject`, and `occurred`.

For each dimension, an entry's value wins over the shared option. Otherwise the client omits the route or occurrence time and the kernel resolves it. Explicit empty route strings are sent unchanged; they ask the kernel to resolve that dimension, not to use the shared option. Explicit `Default` strings and source-based stream identifiers remain exact values.

Subject policy is unchanged: entry subject, then shared subject, then the event source identifier. Tags remain additive across the event type, entry, and shared options. Reactor bare-event returns retain the triggering stream type and identifier; rich returns retain their explicit metadata.

## Keep concurrency scopes separate

Leave `concurrencyScope` and `concurrencyScopes` configured for the consistency boundary your application requires. Route options do not create or alter a concurrency scope. Per-source scopes still override the shared scope independently of the append route.

## Verify the selected stream

Read the appended events and verify `context.eventSourceType`, `context.eventStreamType`, `context.eventStreamId`, and `context.subject`. Reads, reactors, and reducers preserve the kernel's metadata, including occurrence time, correlation identifier, causation, tags, identity, hash, and observation state. The added context properties are optional so existing consumer-created contexts remain valid.

Do not use local `appendOperations` metadata as proof of the persisted route until the receipt-backed notification update is installed. That update must use kernel receipts, not reconstruct successful metadata from request options.
