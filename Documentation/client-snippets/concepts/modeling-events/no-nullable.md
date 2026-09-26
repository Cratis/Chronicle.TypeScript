```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ModelingEventsOrderId {
    @field(String) readonly value: string;

    constructor(value: string) {
        this.value = value;
    }
}

class ModelingEventsMoney {
    @field(Number) readonly amount: number;
    @field(String) readonly currency: string;

    constructor(amount: number, currency: string) {
        this.amount = amount;
        this.currency = currency;
    }
}

// Nullable smell — "sometimes there's a discount, sometimes not"
@eventType()
class ModelingEventsOrderPlacedWithNullableDiscount {
    @field(ModelingEventsOrderId) readonly id: ModelingEventsOrderId;
    @field(ModelingEventsMoney) readonly total: ModelingEventsMoney;
    @field(ModelingEventsMoney) readonly discount?: ModelingEventsMoney;

    constructor(id: ModelingEventsOrderId, total: ModelingEventsMoney, discount?: ModelingEventsMoney) {
        this.id = id;
        this.total = total;
        this.discount = discount;
    }
}

// Two facts
@eventType()
class ModelingEventsOrderPlaced {
    @field(ModelingEventsOrderId) readonly id: ModelingEventsOrderId;
    @field(ModelingEventsMoney) readonly total: ModelingEventsMoney;

    constructor(id: ModelingEventsOrderId, total: ModelingEventsMoney) {
        this.id = id;
        this.total = total;
    }
}

@eventType()
class ModelingEventsDiscountApplied {
    @field(ModelingEventsOrderId) readonly id: ModelingEventsOrderId;
    @field(ModelingEventsMoney) readonly amount: ModelingEventsMoney;

    constructor(id: ModelingEventsOrderId, amount: ModelingEventsMoney) {
        this.id = id;
        this.amount = amount;
    }
}
```
