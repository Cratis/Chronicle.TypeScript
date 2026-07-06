```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecFunctionsItemAdded {
    name = '';
}

@eventType()
class DecFunctionsItemRemoved {
    name = '';
}

class DecFunctionsInventory {
    quantity = 0;
}

@projection()
class DecFunctionsInventoryProjection implements IProjectionFor<DecFunctionsInventory> {
    define(builder: IProjectionBuilderFor<DecFunctionsInventory>): void {
        builder
            .autoMap()
            .from(DecFunctionsItemAdded, _ => _
                .increment(m => m.quantity))
            .from(DecFunctionsItemRemoved, _ => _
                .decrement(m => m.quantity));
    }
}
```
