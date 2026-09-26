```typescript
import { IEventStore, eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TransactionalOrderPlaced {
    @field(String) readonly orderId: string;
    @field(Number) readonly totalAmount: number;

    constructor(orderId: string, totalAmount: number) {
        this.orderId = orderId;
        this.totalAmount = totalAmount;
    }
}

@eventType()
class TransactionalInventoryReserved {
    @field(String) readonly sku: string;
    @field(Number) readonly quantity: number;

    constructor(sku: string, quantity: number) {
        this.sku = sku;
        this.quantity = quantity;
    }
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
