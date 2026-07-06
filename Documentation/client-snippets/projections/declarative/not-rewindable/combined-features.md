```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecNotRewindableOrderReceived {
    orderId = '';
}

@eventType()
class DecNotRewindableOrderProcessing {
    orderId = '';
}

@eventType()
class DecNotRewindableOrderCompleted {
    orderId = '';
}

class DecNotRewindableOrderStatus {
    status = '';
    lastUpdatedAt = new Date();
}

@projection()
class DecNotRewindableRealTimeOrderStatusProjection implements IProjectionFor<DecNotRewindableOrderStatus> {
    define(builder: IProjectionBuilderFor<DecNotRewindableOrderStatus>): void {
        builder
            .notRewindable()
            .fromEventSequence('order-processing')
            .passive()
            .autoMap()
            .fromEvery(_ => _
                .set(m => m.lastUpdatedAt).toEventContextProperty('occurred'))
            .from(DecNotRewindableOrderReceived, _ => _
                .set(m => m.status).toValue('RECEIVED'))
            .from(DecNotRewindableOrderProcessing, _ => _
                .set(m => m.status).toValue('PROCESSING'))
            .from(DecNotRewindableOrderCompleted, _ => _
                .set(m => m.status).toValue('COMPLETED'));
    }
}
```
