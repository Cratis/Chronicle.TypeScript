```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

const eventSequences = {
    orderManagement: 'order-management'
};

@projection()
class DecFromEventSequenceOrderProjectionWithConstant implements IProjectionFor<DecFromEventSequenceOrder> {
    define(builder: IProjectionBuilderFor<DecFromEventSequenceOrder>): void {
        builder
            // Using a constant instead of a raw string keeps the sequence identifier consistent
            // wherever it is referenced.
            .fromEventSequence(eventSequences.orderManagement)
            .autoMap()
            .from(DecFromEventSequenceOrderCreated);
    }
}
```
