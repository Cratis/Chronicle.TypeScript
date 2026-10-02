```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventStreamType, Guid, IEventLog, reducer } from '@cratis/chronicle';

@eventType()
class ReducersFilteringShipmentSent {
    @field(Number) shippingCost = 0;
}

class ReducersFilteringShippingTotals { count = 0; totalCost = 0; }

class ReducersFilteringShippingService {
    constructor(private readonly eventLog: IEventLog) {}

    async send(shippingCost: number): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReducersFilteringShipmentSent(), { shippingCost }), { streamType: 'shipping' });
        if (!result.isSuccess) throw new Error('Shipment send failed');
    }
}

@reducer('', undefined, ReducersFilteringShippingTotals)
@eventStreamType('shipping')
class ReducersFilteringShippingTotalsReducer {
    reducersFilteringShipmentSent(event: ReducersFilteringShipmentSent,
        current: ReducersFilteringShippingTotals | undefined): ReducersFilteringShippingTotals {
        return { count: (current?.count ?? 0) + 1, totalCost: (current?.totalCost ?? 0) + event.shippingCost };
    }
}
```
