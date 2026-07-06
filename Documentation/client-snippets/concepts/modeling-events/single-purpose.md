```typescript
import { eventType } from '@cratis/chronicle';

class ModelingEventsCustomerName {
    constructor(readonly value: string) {}
}

class ModelingEventsEmail {
    constructor(readonly value: string) {}
}

class ModelingEventsDeactivationReason {
    constructor(readonly value: string) {}
}

class ModelingEventsCustomerAddress {
    constructor(
        readonly street: string,
        readonly city: string
    ) {}
}

// One event trying to be everything — consumers must guess what changed
@eventType()
class ModelingEventsCustomerUpdated {
    constructor(
        readonly name?: ModelingEventsCustomerName,
        readonly address?: ModelingEventsCustomerAddress,
        readonly email?: ModelingEventsEmail,
        readonly deactivated?: boolean
    ) {}
}

// Distinct facts — each consumer subscribes to exactly what it cares about
@eventType()
class ModelingEventsCustomerRenamed {
    constructor(readonly name: ModelingEventsCustomerName) {}
}

@eventType()
class ModelingEventsCustomerAddressChanged {
    constructor(readonly address: ModelingEventsCustomerAddress) {}
}

@eventType()
class ModelingEventsCustomerDeactivated {
    constructor(readonly reason: ModelingEventsDeactivationReason) {}
}
```
