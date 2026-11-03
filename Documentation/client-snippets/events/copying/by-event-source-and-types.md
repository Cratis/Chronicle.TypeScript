```typescript
import { eventType, Guid, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CopyAccountOpened {
    @field(String) readonly name: string;

    constructor(name: string = '') {
        this.name = name;
    }
}

@eventType()
class CopyAddressChanged {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string = '', city: string = '') {
        this.street = street;
        this.city = city;
    }
}

class CopyByEventSourceAndTypesService {
    constructor(private readonly eventLog: IEventLog) {}

    copyAccountDetails(sourceId: string, targetId: string): Promise<Guid> {
        return this.eventLog.copy(sourceId, targetId, CopyAccountOpened, CopyAddressChanged);
    }
}
```
