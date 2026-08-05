```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class RedactionPersonalDetailsRecorded {
    constructor(readonly name: string = '', readonly socialSecurityNumber: string = '') {}
}

@eventType()
class RedactionAddressChanged {
    constructor(readonly street: string = '', readonly city: string = '') {}
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
