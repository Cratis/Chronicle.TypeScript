```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class ReducersGettingStartedOrderCreated {
    orderId = '';
}

@eventType()
class ReducersGettingStartedItemAddedToOrder {
    price = 0;
    quantity = 0;
}

@eventType()
class ReducersGettingStartedItemRemovedFromOrder {
    price = 0;
    quantity = 0;
}

// Method names must be the exact camelCase of the event's class name -
// Chronicle discovers handlers by name, not by parameter type.
@reducer('', undefined, ReducersGettingStartedOrderSummary)
class ReducersGettingStartedOrderSummaryReducer {
    reducersGettingStartedOrderCreated(
        event: ReducersGettingStartedOrderCreated,
        _current: ReducersGettingStartedOrderSummary | undefined
    ): ReducersGettingStartedOrderSummary {
        return { orderId: event.orderId, totalAmount: 0, itemCount: 0, lastUpdated: new Date() };
    }

    reducersGettingStartedItemAddedToOrder(
        event: ReducersGettingStartedItemAddedToOrder,
        current: ReducersGettingStartedOrderSummary | undefined
    ): ReducersGettingStartedOrderSummary | undefined {
        if (!current) return undefined; // Skip if order not created yet

        return {
            ...current,
            totalAmount: current.totalAmount + (event.price * event.quantity),
            itemCount: current.itemCount + event.quantity,
            lastUpdated: new Date()
        };
    }

    reducersGettingStartedItemRemovedFromOrder(
        event: ReducersGettingStartedItemRemovedFromOrder,
        current: ReducersGettingStartedOrderSummary | undefined
    ): ReducersGettingStartedOrderSummary | undefined {
        if (!current) return undefined; // Skip if order not created yet

        return {
            ...current,
            totalAmount: current.totalAmount - (event.price * event.quantity),
            itemCount: current.itemCount - event.quantity,
            lastUpdated: new Date()
        };
    }
}
```
