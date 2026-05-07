# Event Log

The event log is the primary event sequence in an event store. All domain events are appended to it.

## Appending Events

```typescript
import { ChronicleClient, ChronicleOptions, eventType } from '@cratis/chronicle';

@eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
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
