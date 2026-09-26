```typescript
import { IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class DesigningReadModelsCustomerListItem {
    @field(String) readonly id: string;
    @field(String) readonly name: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
}

class DesigningReadModelsCustomerListService {
    constructor(private readonly store: IEventStore) {}

    // Strongly consistent — Chronicle replays the read model's events on demand
    getAllStronglyConsistent(): Promise<DesigningReadModelsCustomerListItem[]> {
        return this.store.readModels.getInstances(DesigningReadModelsCustomerListItem);
    }

    // Eventually consistent — a page of materialized instances straight from storage
    getPageEventuallyConsistent(): Promise<DesigningReadModelsCustomerListItem[]> {
        return this.store.readModels.materialized.getInstances(DesigningReadModelsCustomerListItem, 0, 20);
    }
}
```
