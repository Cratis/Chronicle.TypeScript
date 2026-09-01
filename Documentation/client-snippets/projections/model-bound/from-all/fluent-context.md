```typescript
import { eventType, Guid, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class InventoryRegisteredFromAll {
    constructor(readonly productName: string) {}
}

@eventType()
class InventoryAdjustedFromAll {
    constructor(readonly quantity: number) {}
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
