# Event Log

The event log is the primary event sequence in an event store. All domain events are appended to it.

## Appending Events

```typescript
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

const client = new ChronicleClient(ChronicleOptions.development());
const store = await client.getEventStore('MyStore');

const result = await store.eventLog.append('employee-123', new EmployeeHired('Jane', 'Doe'));

if (result.isSuccess) {
    console.log(`Event appended at sequence number ${result.sequenceNumber.value}`);
} else {
    console.error('Append failed:', result.errors);
}
```

## Appending Multiple Events

```typescript
const results = await store.eventLog.appendMany('employee-123', [
    new EmployeeHired('Jane', 'Doe'),
    new EmployeePromoted('Senior Engineer')
]);
```

## Using Concurrency Scope

Use `AppendOptions.concurrencyScope` when you want Chronicle to validate expected sequence state before committing events.
Use `eventSourceType` + `eventSourceId` when your concurrency boundary is the whole event source.
Use `eventStreamType` + `eventStreamId` when you need concurrency validation against one stream within that source.

```typescript
import { ChronicleClient, ChronicleOptions, eventType, getEventTypeFor } from '@cratis/chronicle';

@eventType()
class EmployeeHired {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

@eventType()
class EmployeePromoted {
    constructor(readonly title: string) {}
}

async function appendWithConcurrencyScopes() {
    const client = new ChronicleClient(ChronicleOptions.development());
    const store = await client.getEventStore('MyStore');
    const eventSourceId = 'employee-123';
    const expectedTail = (await store.eventLog.getTailSequenceNumber(eventSourceId)).value;

    // Scope concurrency to this event source.
    const appendResult = await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe'), {
        concurrencyScope: {
            sequenceNumber: expectedTail,
            eventSourceId: true
        }
    });

    if (!appendResult.isSuccess) {
        console.error(appendResult.errors, appendResult.constraintViolations);
    }

    // Combine source + stream fields when your boundary is a specific stream in a specific source.
    const appendManyResults = await store.eventLog.appendMany(eventSourceId, [
        new EmployeeHired('Jane', 'Doe'),
        new EmployeePromoted('Senior Engineer')
    ], {
        concurrencyScope: {
            sequenceNumber: expectedTail,
            eventSourceId: true,
            eventSourceType: 'Default',
            eventStreamType: 'Default',
            eventStreamId: eventSourceId,
            eventTypes: [getEventTypeFor(EmployeeHired), getEventTypeFor(EmployeePromoted)]
        }
    });

    if (appendManyResults.some(_ => !_.isSuccess)) {
        console.error(appendManyResults);
    }
}

await appendWithConcurrencyScopes();
```

## Checking for Events

```typescript
const hasEvents = await store.eventLog.hasEventsFor('employee-123');
```

## Getting the Tail Sequence Number

The tail sequence number is the sequence number of the most recently appended event:

```typescript
const tailSequenceNumber = await store.eventLog.getTailSequenceNumber('employee-123');
console.log(`Latest event at: ${tailSequenceNumber.value}`);
```

## AppendResult

Every append returns an `AppendResult`:

| Property | Description |
|----------|-------------|
| `sequenceNumber` | The sequence number assigned to the appended event. |
| `isSuccess` | `true` if there were no errors or constraint violations. |
| `errors` | Array of error messages, if any. |
| `constraintViolations` | Array of constraint violations, if any. |
