```typescript
import { childrenFrom, eventType, Guid, removedWith, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// Events
@eventType()
export class MbRemovalFullShoppingCartCreated {
    customerName = '';
}

@eventType()
export class MbRemovalFullItemAddedToCart {
    itemId: Guid = Guid.empty;
    productName = '';
    price = 0;
}

@eventType()
export class MbRemovalFullItemRemovedFromCart {
    cartId: Guid = Guid.empty;
    itemId: Guid = Guid.empty;
}

@eventType()
export class MbRemovalFullCartCheckedOut {
}

@eventType()
export class MbRemovalFullCartAbandoned {
}

// Read Models
@removedWith(MbRemovalFullItemRemovedFromCart, 'itemId', 'cartId')
export class MbRemovalFullCartItem {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalFullItemAddedToCart, 'productName')
    product = '';

    @setFrom(MbRemovalFullItemAddedToCart, 'price')
    price = 0;
}

@removedWith(MbRemovalFullCartCheckedOut)
@removedWith(MbRemovalFullCartAbandoned)
export class MbRemovalFullShoppingCart {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalFullShoppingCartCreated, 'customerName')
    customer = '';

    @childrenFrom(MbRemovalFullItemAddedToCart, 'itemId')
    @field(Array, { genericArguments: [MbRemovalFullCartItem] }) items: MbRemovalFullCartItem[] = [];
}
```
