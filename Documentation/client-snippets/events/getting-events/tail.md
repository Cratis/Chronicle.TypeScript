```typescript
import { IEventStore } from '@cratis/chronicle';

async function reportSequencePosition(store: IEventStore): Promise<void> {
    // The tail is the most recently appended event; unset (EventSequenceNumber.unset)
    // when the sequence is empty.
    const tail = await store.eventLog.getTailSequenceNumber();

    // getNextSequenceNumber is one past the tail, or EventSequenceNumber.first when
    // empty - the sequence number the next appended event will receive.
    const next = await store.eventLog.getNextSequenceNumber();

    console.log(`Tail: ${tail.value}, next append will be at: ${next.value}`);
}
```
