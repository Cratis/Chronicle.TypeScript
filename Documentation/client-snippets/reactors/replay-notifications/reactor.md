```typescript
import { eventType, handles, ICanBeNotifiedWhenReplay, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReplayNotifiedOrderPlaced {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
}

interface IReplayNotificationGate {
    pause(): void;
    resume(): void;
}

@reactor('replay-notified-orders')
class ReplayNotifiedOrderReactor implements ICanBeNotifiedWhenReplay {
    constructor(private readonly gate: IReplayNotificationGate) {}

    async beginReplay(): Promise<void> {
        this.gate.pause();
    }

    async endReplay(): Promise<void> {
        this.gate.resume();
    }

    @handles(ReplayNotifiedOrderPlaced)
    async orderPlaced(event: ReplayNotifiedOrderPlaced): Promise<void> {
        // Handles the event both live and during the replay.
    }
}
```
