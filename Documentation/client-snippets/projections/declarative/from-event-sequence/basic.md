```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecFromEventSequenceOrderProjection implements IProjectionFor<DecFromEventSequenceOrder> {
    define(builder: IProjectionBuilderFor<DecFromEventSequenceOrder>): void {
        builder
            .fromEventSequence('order-management')
            .autoMap()
            .from(DecFromEventSequenceOrderCreated)
            .from(DecFromEventSequenceOrderUpdated)
            .from(DecFromEventSequenceOrderShipped);
    }
}
```
