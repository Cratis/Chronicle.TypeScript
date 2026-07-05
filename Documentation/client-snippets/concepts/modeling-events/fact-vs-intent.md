```typescript
import { eventType } from '@cratis/chronicle';

class ModelingEventsAddress {
    constructor(
        readonly street: string,
        readonly city: string
    ) {}
}

// A fact that happened
@eventType()
class ModelingEventsAddressChanged {
    constructor(readonly address: ModelingEventsAddress) {}
}

// An intent (that's a command) or a state blob (that's a read model) — not an event
@eventType()
class ModelingEventsUpdateAddress {
    constructor(readonly address: ModelingEventsAddress) {}
}
```
