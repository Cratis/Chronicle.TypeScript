```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ModelingEventsAddress {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string, city: string) {
        this.street = street;
        this.city = city;
    }
}

// A fact that happened
@eventType()
class ModelingEventsAddressChanged {
    @field(ModelingEventsAddress) readonly address: ModelingEventsAddress;

    constructor(address: ModelingEventsAddress) {
        this.address = address;
    }
}

// An intent (that's a command) or a state blob (that's a read model) — not an event
@eventType()
class ModelingEventsUpdateAddress {
    @field(ModelingEventsAddress) readonly address: ModelingEventsAddress;

    constructor(address: ModelingEventsAddress) {
        this.address = address;
    }
}
```
