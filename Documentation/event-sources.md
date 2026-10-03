---
title: Event sources and streams
description: Register named event sources and streams, append through them, and read the event source back from event metadata.
---

An event source definition gives an event source a stable name, a description, default concurrency dimensions and an optional set of named streams. Routing belongs to the append, not to event types: the same event type can be appended through different definitions.

Declare a definition with `@eventSource` and, optionally, one `@eventStream` per stream. Definitions are discovered and registered with the Kernel at startup, right after event types. Registration is an upsert, and the Kernel keeps definitions you stop registering. Two definitions with the same name, or one definition declaring the same stream twice, fail discovery with `DuplicateEventSourceName` or `DuplicateEventStreamName`. When you omit `name`, the class name without a trailing `EventSource` is used.

```typescript
import { ConcurrencyDimensions, eventSource, eventStream, eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventSource({ name: 'Account', description: 'A bank account', concurrency: ConcurrencyDimensions.eventSourceId })
@eventStream('Transactions', { description: 'Money movements' })
class AccountEventSource {}

@eventSource({ name: 'Customer' })
class CustomerEventSource {}

@eventType()
class AccountFundsDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

async function deposit(log: IEventLog, accountId: string, amount: number) {
    return log.append(accountId, new AccountFundsDeposited(amount), {
        eventSource: AccountEventSource,
        eventStream: 'Transactions',
        streamId: 'transfer-1'
    });
}

async function depositAcrossSources(log: IEventLog, accountId: string, customerId: string) {
    return log.appendMany([
        { eventSourceId: accountId, event: new AccountFundsDeposited(10) },
        { eventSourceId: customerId, event: new AccountFundsDeposited(1), eventSource: CustomerEventSource }
    ], { eventSource: AccountEventSource, eventStream: 'Transactions' });
}
```

## Append through a definition

Pass `eventSource` (the class or its name) in the append options, and optionally `eventStream`. The client:

- writes the definition name as the event source type and as the `EventSource` key on the event;
- writes the stream name as the event stream type, while `streamId` stays yours to choose;
- throws `UnknownEventSource`, `EventStreamDoesNotBelongToEventSource`, `EventStreamRequiresEventSource` or `EventRoutingContradictsEventSource` before anything is sent. A batch is validated in full first, so it stays atomic.

An `appendMany` with `EventForEventSourceId` entries can carry `eventSource` and `eventStream` per event; they win over the shared options, and a shared stream is never inherited by an event that names a different source.

## Concurrency

When no `concurrencyScope` (and no matching entry in `concurrencyScopes`) is supplied, and the definition declares concurrency dimensions, the client reads the tail sequence number for exactly those dimensions and uses it as the expected scope. A stream's dimensions replace the source's when it declares any. An empty scope expects no matching event. An explicit scope always wins, and a definition with no dimensions adds no check.

## Read the event source back

`context.eventSource` on appended events, reactor and reducer deliveries holds the definition name. It is `undefined` for events appended without a definition, including events stored before event sources existed.

Event source routing needs a Kernel that supports registered event sources (Chronicle 19.30.0 or later) and `@cratis/chronicle.contracts` 19.30.0. Existing appends, options and event contexts are unchanged. Transactional (`unitOfWork`) appends and the in-process test scenarios do not support definitions yet; the scenarios reject the new options.
