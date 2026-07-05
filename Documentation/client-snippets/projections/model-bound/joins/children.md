```typescript
import { childrenFrom, eventType, Guid, join, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbJoinsLineItemAdded {
    productId: Guid = Guid.empty;
    quantity = 0;
}

@eventType()
class MbJoinsProductUpdated {
    productName = '';
    currentPrice = 0;
}

@readModel()
class MbJoinsOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbJoinsLineItemAdded, 'productId')
    lines: MbJoinsOrderLine[] = [];
}

// The line's key is the product id, so the join to ProductUpdated (raised on that
// same product's event source) resolves implicitly through the child's own key.
class MbJoinsOrderLine {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsLineItemAdded, 'quantity')
    quantity = 0;

    @join(MbJoinsProductUpdated, undefined, 'productName')
    productName = '';

    @join(MbJoinsProductUpdated, undefined, 'currentPrice')
    price = 0;
}
```
