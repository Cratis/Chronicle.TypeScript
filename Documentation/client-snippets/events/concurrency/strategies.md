Set `ChronicleOptions.concurrencyScopeStrategy` to choose how single and batch appends resolve scopes when you do not supply one. `ConcurrencyScopeStrategies.optimistic` is the default: registered routing dimensions select a scoped tail, including the existing first-append guard for an empty stream. Without registered concurrency dimensions, it requests no check.

`ConcurrencyScopeStrategies.none` skips derivation and tail reads. It provides no lost-update protection unless you supply an explicit scope. Custom callbacks can return a scope or `undefined` for no check, synchronously or asynchronously. They run once per event source id and receive that id's events, the shared append options, and the sequence's tail reader. A thrown error or rejected promise fails the entire append before anything is written; it never falls back to no-check.

An explicit `concurrencyScope` always wins. For batches, `concurrencyScopes[id]` takes precedence over the shared scope, and only ids without an explicit scope use the strategy. A batch has one scope per event source id, even when it contains several events for that id.

```typescript
import { ChronicleOptions, ConcurrencyScopeStrategies, EventSequenceNumber, type ConcurrencyScopeStrategy } from '@cratis/chronicle';

function createConcurrencyStrategyOptions(): ChronicleOptions[] {
    const optimistic = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        concurrencyScopeStrategy: ConcurrencyScopeStrategies.optimistic
    });
    const noCheck = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        concurrencyScopeStrategy: ConcurrencyScopeStrategies.none
    });
    // This custom policy checks the source-wide tail instead of the registered stream dimensions.
    const sourceWide: ConcurrencyScopeStrategy = async ({ eventSourceId, readTail }) => {
        const tail = await readTail(eventSourceId);
        const sequenceNumber = tail.value === EventSequenceNumber.unset.value
            ? EventSequenceNumber.beforeFirst.value : tail.value;
        return { sequenceNumber, eventSourceId: true };
    };
    const custom = ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
        concurrencyScopeStrategy: sourceWide
    });
    return [optimistic, noCheck, custom];
}
```
