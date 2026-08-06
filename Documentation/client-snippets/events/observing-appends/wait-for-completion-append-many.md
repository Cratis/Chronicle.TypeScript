```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class ObservingAppendsFirstEvent {
    constructor(readonly data: string = '') {}
}

@eventType()
class ObservingAppendsSecondEvent {
    constructor(readonly data: string = '') {}
}

async function appendManyAndWait(eventLog: IEventLog, eventSourceId: string): Promise<void> {
    const appendManyResults = await eventLog.appendMany(eventSourceId, [
        new ObservingAppendsFirstEvent('first'),
        new ObservingAppendsSecondEvent('second')
    ]);

    for (const appendResult of appendManyResults) {
        const completion = await appendResult.waitForCompletion();
        if (!completion.isSuccess) {
            // Inspect completion.failedPartitions from affected observers.
        }
    }
}
```
