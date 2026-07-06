```typescript
import { childrenFrom, eventType, Guid, join, readModel } from '@cratis/chronicle';

@eventType()
class MbJoinsSourcesLineItemAdded {
    productId: Guid = Guid.empty;
}

@eventType()
class MbJoinsSourcesProductCatalogUpdated {
    name = '';
    description = '';
}

@eventType()
class MbJoinsSourcesPricingUpdated {
    currentPrice = 0;
}

@readModel()
class MbJoinsSourcesOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbJoinsSourcesLineItemAdded, 'productId')
    lines: MbJoinsSourcesOrderLine[] = [];
}

// Keyed by product id, so both joins below resolve implicitly through the child's own key.
class MbJoinsSourcesOrderLine {
    id: Guid = Guid.empty;

    @join(MbJoinsSourcesProductCatalogUpdated, undefined, 'name')
    productName = '';

    @join(MbJoinsSourcesProductCatalogUpdated, undefined, 'description')
    description = '';

    @join(MbJoinsSourcesPricingUpdated, undefined, 'currentPrice')
    unitPrice = 0;
}
```
