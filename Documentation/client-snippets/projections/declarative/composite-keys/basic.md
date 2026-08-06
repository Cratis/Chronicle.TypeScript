```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection('')
class CompositeOrderProjection implements IProjectionFor<CompositeOrder> {
    define(builder: IProjectionBuilderFor<CompositeOrder>): void {
        builder
            .from(CompositeOrderCreated, from => from
                .usingCompositeKey<CompositeOrderKey>(key => key
                    .set(target => target.customerId, event => event.customerId)
                    .set(target => target.orderNumber, event => event.orderNumber)))
            .from(CompositeOrderShipped, from => from
                .usingCompositeKey<CompositeOrderKey>(key => key
                    .set(target => target.customerId, event => event.customerId)
                    .set(target => target.orderNumber, event => event.orderNumber)));
    }
}
```
