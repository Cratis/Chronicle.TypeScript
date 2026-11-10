```typescript
import { eventType, IEventLog, ImportResult } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class LegacyOrderPlaced {
    @field(String) readonly orderNumber: string;

    constructor(orderNumber: string = '') {
        this.orderNumber = orderNumber;
    }
}

class OrderMigration {
    constructor(private readonly eventLog: IEventLog) {}

    async run(batches: Iterable<Iterable<{ orderId: string; orderNumber: string }>>): Promise<ImportResult> {
        const session = await this.eventLog.beginImport({ maxChunksInFlight: 4 });
        console.log(`Importing as ${session.importId.toString()}`);

        for (const batch of batches) {
            await session.add([...batch].map(order => ({ eventSourceId: order.orderId, event: new LegacyOrderPlaced(order.orderNumber) })));
        }

        return session.complete();
    }
}
```
