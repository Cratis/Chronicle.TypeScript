```typescript title="Defaults for fields events do not set"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class InitialValuesStockReceived {
    @field(Number) readonly quantity: number;

    constructor(quantity: number) {
        this.quantity = quantity;
    }
}

@eventType()
class InitialValuesStockReserved {
    @field(Number) readonly quantity: number;

    constructor(quantity: number) {
        this.quantity = quantity;
    }
}

class InitialValuesInventoryItem {
    currentStock = 0;
    reservedStock = 0;
    lastUpdated = new Date(0);
    minimumLevel = 10;
    maximumLevel = 1000;
    reorderPoint = 20;
}

@projection()
class InitialValuesInventoryProjection implements IProjectionFor<InitialValuesInventoryItem> {
    define(builder: IProjectionBuilderFor<InitialValuesInventoryItem>): void {
        builder
            .withInitialValues(() => new InitialValuesInventoryItem())
            .from(InitialValuesStockReceived, _ => _
                .add(m => m.currentStock).with(e => e.quantity)
                .set(m => m.lastUpdated).toEventContextProperty('occurred'))
            .from(InitialValuesStockReserved, _ => _
                .add(m => m.reservedStock).with(e => e.quantity)
                .set(m => m.lastUpdated).toEventContextProperty('occurred'));
    }
}
```
