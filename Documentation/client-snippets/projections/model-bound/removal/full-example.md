```typescript
import { childrenFrom, eventType, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

// Events
@eventType()
class MbRemovalFullShoppingCartCreated {
    customerName = '';
}

@eventType()
class MbRemovalFullItemAddedToCart {
    itemId: Guid = Guid.empty;
    productName = '';
    price = 0;
}

@eventType()
class MbRemovalFullItemRemovedFromCart {
    cartId: Guid = Guid.empty;
    itemId: Guid = Guid.empty;
}

@eventType()
class MbRemovalFullCartCheckedOut {
}

@eventType()
class MbRemovalFullCartAbandoned {
}

// Read Models
@readModel()
@removedWith(MbRemovalFullCartCheckedOut)
@removedWith(MbRemovalFullCartAbandoned)
class MbRemovalFullShoppingCart {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalFullShoppingCartCreated, 'customerName')
    customer = '';

    @childrenFrom(MbRemovalFullItemAddedToCart, 'itemId')
    items: MbRemovalFullCartItem[] = [];
}

@removedWith(MbRemovalFullItemRemovedFromCart, 'itemId', 'cartId')
class MbRemovalFullCartItem {
    id: Guid = Guid.empty;

    @setFrom(MbRemovalFullItemAddedToCart, 'productName')
    product = '';

    @setFrom(MbRemovalFullItemAddedToCart, 'price')
    price = 0;
}
```
