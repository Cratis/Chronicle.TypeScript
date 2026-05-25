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
Use `eventSourceId: true` when you want validation across all events for the `eventSourceId` you pass to `append()` / `appendMany()`.
Set `eventSourceType` when you use custom source partitioning (grouping events by named source types). Omit it for default partitioning.
Use `eventStreamType` + `eventStreamId` when you need concurrency validation against one stream within that source.
Set `sequenceNumber` to the last known sequence number that must already exist before Chronicle accepts the append.
Set `eventTypes` when you want concurrency validation to consider only specific event types.
The sample below shows one end-to-end flow using source-level and stream-level concurrency scopes.
`getTailSequenceNumber()` always returns an `EventSequenceNumber`, so you pass its `.value` (a `bigint`) to `sequenceNumber`.

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

@eventType()
class EmployeeDepartmentChanged {
    constructor(readonly department: string) {}
}

async function appendWithConcurrencyScopes() {
    const client = new ChronicleClient(ChronicleOptions.development());
    const store = await client.getEventStore('MyStore');
    const eventSourceId = 'employee-123';
    const expectedSequenceNumber = (await store.eventLog.getTailSequenceNumber(eventSourceId)).value;

    // Scope concurrency to this event source.
    const appendResult = await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe'), {
        concurrencyScope: {
            sequenceNumber: expectedSequenceNumber,
            // true means "use the eventSourceId parameter passed to append()".
            eventSourceId: true
        }
    });

    if (!appendResult.isSuccess) {
        console.error(appendResult.errors, appendResult.constraintViolations);
        return;
    }

    const expectedSequenceNumberForBatch = (await store.eventLog.getTailSequenceNumber(eventSourceId)).value;

    // Combine source + stream fields when your boundary is a specific stream in a specific source.
    // In this event log example, stream ID matches source ID; custom stream partitioning can use a different stream ID.
    const appendManyResults = await store.eventLog.appendMany(eventSourceId, [
        new EmployeePromoted('Senior Engineer'),
        new EmployeeDepartmentChanged('Platform')
    ], {
        concurrencyScope: {
            sequenceNumber: expectedSequenceNumberForBatch,
            eventSourceId: true,
            eventSourceType: 'Employee', // Custom source type example.
            eventStreamType: 'Career',
            eventStreamId: `${eventSourceId}-career`,
            eventTypes: [getEventTypeFor(EmployeePromoted), getEventTypeFor(EmployeeDepartmentChanged)]
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
