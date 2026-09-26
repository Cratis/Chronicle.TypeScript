```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TransferDebited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class TransferCredited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class TransactionalTransferWorkflow {
    constructor(private readonly store: IEventStore) {}

    async tryCommitTransfer(expectedAuthorizationRevision: bigint): Promise<boolean> {
        // Sent immediately as one ordered, atomic batch; TypeScript's unit of work has no concurrency scopes.
        const results = await this.store.eventLog.appendMany([
            { eventSourceId: 'account-from', event: new TransferDebited(100) },
            { eventSourceId: 'account-to', event: new TransferCredited(100) }
        ], {
            concurrencyScopes: {
                'authorization-history': {
                    sequenceNumber: expectedAuthorizationRevision,
                    eventStreamType: 'authorization'
                }
            }
        });
        return results.length === 2 && results.every(result => result.isSuccess);
    }
}
```
