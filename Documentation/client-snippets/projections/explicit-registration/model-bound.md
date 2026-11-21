```typescript
import { eventType, fromEvent, IEventStore, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SupplierOnboarded {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@fromEvent(SupplierOnboarded)
class Supplier {
    @setFrom(SupplierOnboarded, 'name')
    name = '';
}

class SupplierRegistration {
    register(eventStore: IEventStore): Promise<void> {
        return eventStore.readModels.register(Supplier);
    }
}
```
