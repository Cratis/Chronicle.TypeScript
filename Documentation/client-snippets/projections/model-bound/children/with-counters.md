```typescript
import { childrenFrom, decrement, eventType, Guid, increment, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenCountersItemAddedToCart {
    itemId: Guid = Guid.empty;
    productName = '';
    price = 0;
    initialQuantity = 0;
}

@eventType()
export class MbChildrenCountersQuantityIncreased {
    itemId: Guid = Guid.empty;
}

@eventType()
export class MbChildrenCountersQuantityDecreased {
    itemId: Guid = Guid.empty;
}

// Child type with its own projection decorators
export class MbChildrenCountersCartItem {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenCountersItemAddedToCart, 'productName')
    productName = '';

    @setFrom(MbChildrenCountersItemAddedToCart, 'price')
    price = 0;

    @setFrom(MbChildrenCountersItemAddedToCart, 'initialQuantity')
    @increment(MbChildrenCountersQuantityIncreased)
    @decrement(MbChildrenCountersQuantityDecreased)
    quantity = 0;
}

export class MbChildrenCountersShoppingCart {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenCountersItemAddedToCart, 'itemId')
    @field(Array, { genericArguments: [MbChildrenCountersCartItem] }) items: MbChildrenCountersCartItem[] = [];
}
```
