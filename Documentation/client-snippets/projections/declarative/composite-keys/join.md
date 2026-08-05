```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class CompositeProductUpdated {
    constructor(
        readonly productId: string = '',
        readonly variant: string = '',
        readonly productName: string = ''
    ) {}
}

class CompositeProductKey {
    productId = '';
    variant = '';
}

@readModel()
class CompositeOrderLine {
    id = '';
    productName = '';
}

@projection('', CompositeOrderLine)
class CompositeOrderLineProjection implements IProjectionFor<CompositeOrderLine> {
    define(builder: IProjectionBuilderFor<CompositeOrderLine>): void {
        builder
            .join(CompositeProductUpdated, join => join
                .on(model => model.id)
                .usingCompositeKey<CompositeProductKey>(key => key
                    .set(target => target.productId, event => event.productId)
                    .set(target => target.variant, event => event.variant)));
    }
}
```
