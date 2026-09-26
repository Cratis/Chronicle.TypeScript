```typescript
import { IEventLog } from '@cratis/chronicle';

async function appendImportedOrder(eventLog: IEventLog, eventSourceId: string, customerId: string, total: number) {
    return eventLog.append(
        eventSourceId,
        new OrderPlaced(customerId, total),
        { occurred: new Date('2024-01-15T10:30:00Z') }
    );
}
```
