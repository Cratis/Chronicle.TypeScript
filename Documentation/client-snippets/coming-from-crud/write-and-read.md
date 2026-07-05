```typescript
import { IEventStore } from '@cratis/chronicle';

class CrudComparisonCustomerAddressUpdater {
    constructor(private readonly store: IEventStore) {}

    async changeAddress(customerId: string, newAddress: string): Promise<CrudComparisonCustomerCard> {
        await this.store.eventLog.append(customerId, new CrudComparisonAddressChanged(newAddress));
        return this.store.readModels.getInstanceById(CrudComparisonCustomerCard, customerId);
    }
}
```
