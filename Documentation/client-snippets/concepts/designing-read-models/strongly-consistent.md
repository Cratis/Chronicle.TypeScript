```typescript
import { IEventStore } from '@cratis/chronicle';

class DesigningReadModelsCustomerDetail {
    constructor(
        readonly id: string,
        readonly name: string
    ) {}
}

class DesigningReadModelsCustomerDetailService {
    constructor(private readonly store: IEventStore) {}

    getDetail(customerId: string): Promise<DesigningReadModelsCustomerDetail | null> {
        return this.store.readModels.findInstanceById(DesigningReadModelsCustomerDetail, customerId);
    }
}
```
