```typescript
import { IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class DesigningReadModelsCustomerDetail {
    @field(String) readonly id: string;
    @field(String) readonly name: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
}

class DesigningReadModelsCustomerDetailService {
    constructor(private readonly store: IEventStore) {}

    getDetail(customerId: string): Promise<DesigningReadModelsCustomerDetail | null> {
        return this.store.readModels.findInstanceById(DesigningReadModelsCustomerDetail, customerId);
    }
}
```
