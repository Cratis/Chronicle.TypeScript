```typescript title="Declarative projection with every-event metadata"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class InventoryRegisteredDeclarativeForEvery {
    constructor(readonly productName: string) {}
}

@eventType()
class InventoryAdjustedDeclarativeForEvery {
    constructor(readonly quantity: number) {}
}

@readModel()
class InventoryStatusDeclarativeFromEvery {
    productName = '';
    lastUpdated = new Date();
}

@projection('', InventoryStatusDeclarativeFromEvery)
class InventoryStatusDeclarativeProjection implements IProjectionFor<InventoryStatusDeclarativeFromEvery> {
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
