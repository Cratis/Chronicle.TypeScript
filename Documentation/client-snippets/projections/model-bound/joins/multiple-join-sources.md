```typescript
import { childrenFrom, eventType, Guid, join } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbJoinsSourcesLineItemAdded {
    productId: Guid = Guid.empty;
}

@eventType()
export class MbJoinsSourcesProductCatalogUpdated {
    name = '';
    description = '';
}

@eventType()
export class MbJoinsSourcesPricingUpdated {
    currentPrice = 0;
}

// Keyed by product id, so both joins below resolve implicitly through the child's own key.
export class MbJoinsSourcesOrderLine {
    id: Guid = Guid.empty;

    @join(MbJoinsSourcesProductCatalogUpdated, undefined, 'name')
    productName = '';

    @join(MbJoinsSourcesProductCatalogUpdated, undefined, 'description')
    description = '';

    @join(MbJoinsSourcesPricingUpdated, undefined, 'currentPrice')
    unitPrice = 0;
}

export class MbJoinsSourcesOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbJoinsSourcesLineItemAdded, 'productId')
    @field(Array, { genericArguments: [MbJoinsSourcesOrderLine] }) lines: MbJoinsSourcesOrderLine[] = [];
}
```
