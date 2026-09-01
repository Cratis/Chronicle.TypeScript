```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecConstantKeyOrderPlaced {
    constructor(readonly total: number) {}
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
