```typescript
import { ReadModelChangeType } from '@cratis/chronicle';

const watcher = store.readModels.createWatcher(Order, { signal: AbortSignal.timeout(60_000) });
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

`createWatcher()` starts immediately. Await `subscribed` before producing events when you need to observe their changes. The example stops after one minute; a service can pass its shutdown signal instead. `watch()` keeps its original async-iterable return type and lazy, pull-based behavior: the stream starts on the first `next()`, and each change waits for consumer demand. It has no client-side buffer or overflow limit. Use `createWatcher()` for readiness and lifetime controls.

By default, transport errors reject iteration with the original error and stream completion ends iteration. Registering the `onResubscribed` callback opts this example into resumption: transport failures (gRPC 1/4/13/14) and stream completion resume on the same watcher. You can also opt in explicitly with `createWatcher(Order, { resume: true })`, but must still account for missed changes. `onResubscribed` fires after the next subscription acknowledgment, not the first, so you can refresh even if no further changes arrive. Register before awaiting readiness; late registrations do not replay earlier notifications. Async callbacks are awaited before reading further changes on the resumed stream; a thrown error or rejected promise fails iteration. The returned function unregisters the callback, as does disposal. Removing the last callback disables resumption for subsequent failures unless `resume: true` was passed.

After a disconnect, `watcher.subscribed` waits for the next acknowledgment; previously resolved promises remain resolved. Changes received before the outage are still delivered, but changes during the outage are not reported. The callback refreshes the collection while the loop logs received changes; if you maintain a displayed collection, treat those changes as invalidations and requery rather than overwriting refreshed state with older buffered payloads. Non-transport stream errors, conversion/compliance failures, and callback failures reject iteration and require a new watcher. A terminal connection failure requires a new client after correcting its cause.

For `createWatcher()`, stream reads pause after acknowledgment at 1,024 buffered changes until the consumer pulls. Before each acknowledgment, the watcher must keep reading to reach the marker; exceeding 1,024 buffered changes then fails iteration and readiness. Use `createWatcher(Order, { maxBuffered: 256 })` only if you want overflow failure instead of backpressure; the positive-integer limit applies before and after acknowledgment. Both APIs yield optional `changeType` and `changeContext` fields.
