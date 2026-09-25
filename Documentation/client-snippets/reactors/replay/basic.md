```typescript
import { eventType, reactor, replay } from '@cratis/chronicle';

@eventType()
class ReplayAwareOrderPlaced {
    constructor(readonly orderId: string = '') {}
}

@reactor()
class ReplayAwareOrderReactor {
    replayAwareOrderPlaced(event: ReplayAwareOrderPlaced): void {
        // Runs as the event happens.
    }

    @replay()
    replayReplayAwareOrderPlaced(event: ReplayAwareOrderPlaced): void {
        // Runs instead of replayAwareOrderPlaced during replay.
    }
}
```
