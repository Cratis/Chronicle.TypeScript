```typescript
import { EventContext, eventType, ICanBeNotifiedWhenReplay, reactor } from '@cratis/chronicle';

@eventType()
class ReplayAwareOrderPlaced {
    constructor(readonly orderId: string = '') {}
}

// Implement ICanBeNotifiedWhenReplay to be told when a full replay of this reactor's
// observation begins and ends - useful for suppressing side effects (e.g.
// notifications) while historical events are being reprocessed. A throwing hook marks
// the batch Failed, the same as a handler that throws.
@reactor()
class ReplayAwareOrderReactor implements ICanBeNotifiedWhenReplay {
    private _isReplaying = false;

    async beginReplay(): Promise<void> {
        this._isReplaying = true;
    }

    async endReplay(): Promise<void> {
        this._isReplaying = false;
    }

    async replayAwareOrderPlaced(event: ReplayAwareOrderPlaced, context: EventContext): Promise<void> {
        if (this._isReplaying) {
            // Runs during replay too - skip side effects that must not repeat.
            return;
        }

        // Runs as the event happens for the first time.
    }
}
```
