```typescript
import { EventForEventSourceId, eventType, IEventLog, ImportResult, OnInvalidEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class LegacyCustomerRegistered {
    @field(String) readonly name: string;

    constructor(name: string = '') {
        this.name = name;
    }
}

interface LegacyCustomerRow {
    readonly customerId: string;
    readonly name: string;
    readonly at: Date;
    readonly position: number;
}

class CustomerMigration {
    constructor(private readonly eventLog: IEventLog) {}

    run(rows: AsyncIterable<LegacyCustomerRow>, signal: AbortSignal): Promise<ImportResult> {
        return this.eventLog.import(toEvents(rows), {
            onInvalid: OnInvalidEvent.Reject,
            signal,
            onProgress: progress => console.log(`${progress.state}: ${progress.eventsCommitted} committed`)
        });
    }
}

async function* toEvents(rows: AsyncIterable<LegacyCustomerRow>): AsyncIterable<EventForEventSourceId> {
    for await (const row of rows) {
        yield {
            eventSourceId: row.customerId,
            event: new LegacyCustomerRegistered(row.name),
            occurred: row.at,
            sourceSequenceNumber: row.position
        };
    }
}
```
