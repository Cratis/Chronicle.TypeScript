```typescript title="Declarative projection with every-event metadata"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
export class InventoryRegisteredDeclarativeForEvery {
    constructor(readonly productName: string) {}
}

@eventType()
export class InventoryAdjustedDeclarativeForEvery {
    constructor(readonly quantity: number) {}
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
