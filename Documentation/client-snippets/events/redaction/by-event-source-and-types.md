```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class RedactionPersonalDetailsRecorded {
    @field(String) readonly name: string;
    @field(String) readonly socialSecurityNumber: string;

    constructor(name: string = '', socialSecurityNumber: string = '') {
        this.name = name;
        this.socialSecurityNumber = socialSecurityNumber;
    }
}

@eventType()
class RedactionAddressChanged {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string = '', city: string = '') {
        this.street = street;
        this.city = city;
    }
}

class RedactionByEventSourceAndTypesService {
    constructor(private readonly eventLog: IEventLog) {}

    redactPersonalData(eventSourceId: string): Promise<void> {
        return this.eventLog.redactForEventSource(
            eventSourceId,
            'PII erasure',
            [RedactionPersonalDetailsRecorded, RedactionAddressChanged]);
    }
}
```
