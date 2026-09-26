```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ModelingEventsCustomerName {
    @field(String) readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

class ModelingEventsEmail {
    @field(String) readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

class ModelingEventsDeactivationReason {
    @field(String) readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

class ModelingEventsCustomerAddress {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string, city: string) {
        this.street = street;
        this.city = city;
    }
}

// One event trying to be everything — consumers must guess what changed
@eventType()
class ModelingEventsCustomerUpdated {
    @field(ModelingEventsCustomerName) readonly name?: ModelingEventsCustomerName;
    @field(ModelingEventsCustomerAddress) readonly address?: ModelingEventsCustomerAddress;
    @field(ModelingEventsEmail) readonly email?: ModelingEventsEmail;
    @field(Boolean) readonly deactivated?: boolean;

    constructor(name?: ModelingEventsCustomerName, address?: ModelingEventsCustomerAddress, email?: ModelingEventsEmail, deactivated?: boolean) {
        this.name = name;
        this.address = address;
        this.email = email;
        this.deactivated = deactivated;
    }
}

// Distinct facts — each consumer subscribes to exactly what it cares about
@eventType()
class ModelingEventsCustomerRenamed {
    @field(ModelingEventsCustomerName) readonly name: ModelingEventsCustomerName;

    constructor(name: ModelingEventsCustomerName) {
        this.name = name;
    }
}

@eventType()
class ModelingEventsCustomerAddressChanged {
    @field(ModelingEventsCustomerAddress) readonly address: ModelingEventsCustomerAddress;

    constructor(address: ModelingEventsCustomerAddress) {
        this.address = address;
    }
}

@eventType()
class ModelingEventsCustomerDeactivated {
    @field(ModelingEventsDeactivationReason) readonly reason: ModelingEventsDeactivationReason;

    constructor(reason: ModelingEventsDeactivationReason) {
        this.reason = reason;
    }
}
```
