```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ObservingAppendsFirstEvent {
    @field(String) readonly data: string;

    constructor(data: string = '') {
        this.data = data;
    }
}

@eventType()
class ObservingAppendsSecondEvent {
    @field(String) readonly data: string;

    constructor(data: string = '') {
        this.data = data;
    }
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
