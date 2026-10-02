```typescript
import { ReadModelChangeType } from '@cratis/chronicle';

const watcher = store.readModels.watch(Order, { signal: AbortSignal.timeout(60_000) });
const stopRefreshing = watcher.onResubscribed(async () => {
    // Requery the entire collection, including additions and removals missed during the outage.
    const orders = await store.readModels.getInstances(Order);
    console.table(orders);
});
try {
    await watcher.subscribed;
    // The kernel is now subscribed; events appended after this point can be observed.
    for await (const changeset of watcher) {
        console.log(changeset.changeType === ReadModelChangeType.Added ? 'Added' : 'Changed',
            changeset.key, changeset.changeContext?.correlationId);
        if (!changeset.removed) {
            console.log(changeset.readModel.status);
        }
    }
} finally {
    stopRefreshing();
    watcher.dispose();
}
```

`watch()` starts immediately. Await `subscribed` before producing events when you need to observe their changes. Existing `for await` loops still work without awaiting readiness. The example stops after one minute; a service can pass its shutdown signal instead.

Transport failures (gRPC 1/4/13/14) and stream completion resume on the same watcher. `onResubscribed` fires after the next subscription acknowledgment, not the first, so you can refresh even if no further changes arrive. Register before awaiting readiness; late registrations do not replay earlier notifications. Async callbacks are awaited before reading further changes on the resumed stream; a thrown error or rejected promise fails iteration. The returned function unregisters the callback, as does disposal.

After a disconnect, `watcher.subscribed` waits for the next acknowledgment; previously resolved promises remain resolved. Changes received before the outage are still delivered, but changes during the outage are not reported. The callback refreshes the collection while the loop logs received changes; if you maintain a displayed collection, treat those changes as invalidations and requery rather than overwriting refreshed state with older buffered payloads. Non-transport stream errors, conversion/compliance failures, and callback failures reject iteration and require a new watcher. A terminal connection failure requires a new client after correcting its cause.
