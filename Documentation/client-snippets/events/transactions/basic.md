```typescript
import { IEventStore, eventType } from '@cratis/chronicle';

@eventType()
class TransactionalOrderPlaced {
    constructor(readonly orderId: string, readonly totalAmount: number) {}
}

@eventType()
class TransactionalInventoryReserved {
    constructor(readonly sku: string, readonly quantity: number) {}
}

async function commitOrder(store: IEventStore): Promise<void> {
    const unitOfWork = store.unitOfWorkManager.begin();

    try {
        await store.eventLog.transactional.append(
            'order-123',
            new TransactionalOrderPlaced('order-123', 99.95)
        );

        await store.eventLog.transactional.append(
            'inventory-widget',
            new TransactionalInventoryReserved('widget', 1)
        );

        await unitOfWork.commit();
    } catch (error) {
        await unitOfWork.rollback();
        throw error;
    }
}
```
