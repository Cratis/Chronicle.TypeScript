```typescript
import { IEventLog } from '@cratis/chronicle';

async function monitorAppends(eventLog: IEventLog): Promise<void> {
    for await (const operations of eventLog.appendOperations) {
        for (const item of operations) {
            console.log(`Event ${item.event.eventType.id.value} appended: success=${item.result.isSuccess}`);
        }
    }
}
```
