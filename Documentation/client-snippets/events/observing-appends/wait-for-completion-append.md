```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ObservingAppendsSomeEvent {
    @field(String) readonly data: string;

    constructor(data: string = '') {
        this.data = data;
    }
}

async function appendAndWait(eventLog: IEventLog, eventSourceId: string): Promise<void> {
    const appendResult = await eventLog.append(eventSourceId, new ObservingAppendsSomeEvent('example'));
    const completion = await appendResult.waitForCompletion();

    if (!completion.isSuccess) {
        for (const failedPartition of completion.failedPartitions) {
            console.log(`Observer ${failedPartition.observerId} failed partition ${failedPartition.partition}`);
        }
    }
}
```
