```typescript
import { ReadModelChangeType } from '@cratis/chronicle';

const watcher = store.readModels.watch(Order, { signal: AbortSignal.timeout(60_000) });
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
    watcher.dispose();
}
```

`watch()` starts immediately. Await `subscribed` before producing events when you need to observe their changes. Existing `for await` loops still work without awaiting readiness. The example stops after one minute; a service can pass its shutdown signal instead.

On a connection-lifecycle disconnect, read `watcher.subscribed` again: the next connection gets a fresh acknowledgment. Previously resolved promises remain resolved. Watch streams do not replay missed changes; refresh your query after reconnecting. An independent stream failure rejects iteration and requires a new watcher.
