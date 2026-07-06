```typescript
import { eventType } from '@cratis/chronicle';

class ModelingEventsOrderId {
    constructor(readonly value: string) {}
}

class ModelingEventsMoney {
    constructor(
        readonly amount: number,
        readonly currency: string
    ) {}
}

// Nullable smell — "sometimes there's a discount, sometimes not"
@eventType()
class ModelingEventsOrderPlacedWithNullableDiscount {
    constructor(
        readonly id: ModelingEventsOrderId,
        readonly total: ModelingEventsMoney,
        readonly discount?: ModelingEventsMoney
    ) {}
}

// Two facts
@eventType()
class ModelingEventsOrderPlaced {
    constructor(
        readonly id: ModelingEventsOrderId,
        readonly total: ModelingEventsMoney
    ) {}
}

@eventType()
class ModelingEventsDiscountApplied {
    constructor(
        readonly id: ModelingEventsOrderId,
        readonly amount: ModelingEventsMoney
    ) {}
}
```
