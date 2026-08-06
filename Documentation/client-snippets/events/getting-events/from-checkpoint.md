```typescript
import { EventSequenceNumber, IEventStore } from '@cratis/chronicle';

async function readFrom(store: IEventStore, sequenceNumber: EventSequenceNumber): Promise<void> {
    // Replays from a known checkpoint to rebuild projections or read models.
    const events = await store.eventLog.getFromSequenceNumber(sequenceNumber);

    for (const event of events) {
        console.log(`${event.eventType.id.value} at sequence ${event.context.sequenceNumber}`);
    }
}
```
