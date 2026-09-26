```typescript
import { eventType, Guid, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class InventoryRegisteredFromAll {
    @field(String) readonly productName: string;

    constructor(productName: string) {
        this.productName = productName;
    }
}

@eventType()
class InventoryAdjustedFromAll {
    @field(Number) readonly quantity: number;

    constructor(quantity: number) {
        this.quantity = quantity;
    }
}

class InventoryStatusFromAll {
    id: Guid = Guid.empty;
    productName = '';
    lastUpdated = new Date();
}

@projection()
class InventoryStatusFromAllProjection implements IProjectionFor<InventoryStatusFromAll> {
    define(builder: IProjectionBuilderFor<InventoryStatusFromAll>): void {
        builder
            .from(InventoryRegisteredFromAll)
            .from(InventoryAdjustedFromAll)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred'));
    }
}
```
