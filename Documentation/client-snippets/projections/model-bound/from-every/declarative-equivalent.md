```typescript title="Declarative projection with every-event metadata"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class InventoryRegisteredDeclarativeForEvery {
    @field(String) readonly productName: string;

    constructor(productName: string) {
        this.productName = productName;
    }
}

@eventType()
export class InventoryAdjustedDeclarativeForEvery {
    @field(Number) readonly quantity: number;

    constructor(quantity: number) {
        this.quantity = quantity;
    }
}

export class InventoryStatusDeclarativeFromEvery {
    productName = '';
    lastUpdated = new Date();
}

@projection('', InventoryStatusDeclarativeFromEvery)
export class InventoryStatusDeclarativeProjection implements IProjectionFor<InventoryStatusDeclarativeFromEvery> {
    define(builder: IProjectionBuilderFor<InventoryStatusDeclarativeFromEvery>): void {
        builder
            .from(InventoryRegisteredDeclarativeForEvery)
            .from(InventoryAdjustedDeclarativeForEvery)
            .fromEvery(_ => _
                .set(m => m.lastUpdated)
                .toEventContextProperty('occurred'));
    }
}
```
