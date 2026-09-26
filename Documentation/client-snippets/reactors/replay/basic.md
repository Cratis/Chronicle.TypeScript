```typescript
import { eventType, reactor, replay } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReplayAwareOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string = '') {
        this.orderId = orderId;
    }
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
