```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecConstantKeyOrderPlaced {
    @field(Number) readonly total: number;

    constructor(total: number) {
        this.total = total;
    }
}

class DecConstantKeyGlobalCounter {
    totalOrders = 0;
}

@projection()
class DecConstantKeyGlobalCounterProjection implements IProjectionFor<DecConstantKeyGlobalCounter> {
    define(builder: IProjectionBuilderFor<DecConstantKeyGlobalCounter>): void {
        builder
            .from(DecConstantKeyOrderPlaced, _ => _
                .usingConstantKey('global')
                .count(m => m.totalOrders));
    }
}
```
