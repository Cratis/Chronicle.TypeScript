```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecFromEventSequencePackageCreated {
    packageId = '';
}

@eventType()
class DecFromEventSequencePackageShipped {
    packageId = '';
    shippedAt = new Date();
}

@eventType()
class DecFromEventSequencePackageDelivered {
    packageId = '';
    deliveredAt = new Date();
}

class DecFromEventSequenceShipping {
    packageId = '';
    shippedAt: Date | null = null;
    deliveredAt: Date | null = null;
}

// Projection for order management events
@projection()
class DecFromEventSequenceMultiOrderProjection implements IProjectionFor<DecFromEventSequenceOrder> {
    define(builder: IProjectionBuilderFor<DecFromEventSequenceOrder>): void {
        builder
            .fromEventSequence('order-management')
            .autoMap()
            .from(DecFromEventSequenceOrderCreated, _ => _
                .set(m => m.status).toValue(DecFromEventSequenceOrderStatus.Created));
    }
}

// Projection for shipping events from a different sequence
@projection()
class DecFromEventSequenceShippingProjection implements IProjectionFor<DecFromEventSequenceShipping> {
    define(builder: IProjectionBuilderFor<DecFromEventSequenceShipping>): void {
        builder
            .fromEventSequence('shipping-management')
            .autoMap()
            .from(DecFromEventSequencePackageCreated)
            .from(DecFromEventSequencePackageShipped)
            .from(DecFromEventSequencePackageDelivered);
    }
}
```
