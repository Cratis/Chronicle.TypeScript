```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class CompositeProductUpdated {
    @field(String) readonly productId: string;
    @field(String) readonly variant: string;
    @field(String) readonly productName: string;

    constructor(productId: string = '', variant: string = '', productName: string = '') {
        this.productId = productId;
        this.variant = variant;
        this.productName = productName;
    }
}

export class CompositeProductKey {
    productId = '';
    variant = '';
}

export class CompositeOrderLine {
    id = '';
    productName = '';
}

@projection('', CompositeOrderLine)
export class CompositeOrderLineProjection implements IProjectionFor<CompositeOrderLine> {
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
