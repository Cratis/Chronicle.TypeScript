```typescript
import { childrenFrom, eventType, Guid, noAutoMap, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MbChildrenNoAutoMapLineItemAdded {
    @field(Guid) readonly itemId: Guid;
    @field(String) readonly productName: string;
    @field(Number) readonly quantity: number;
    @field(Number) readonly price: number;

    constructor(itemId: Guid, productName: string, quantity: number, price: number) {
        this.itemId = itemId;
        this.productName = productName;
        this.quantity = quantity;
        this.price = price;
    }
}

@noAutoMap
class MbChildrenNoAutoMapLineItem {
    id: Guid = Guid.empty;

    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'productName')
    productName = '';

    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'quantity')
    quantity = 0;

    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'price')
    price = 0;
}

class MbChildrenNoAutoMapOrder {
    orderId: Guid = Guid.empty;

    @childrenFrom(MbChildrenNoAutoMapLineItemAdded, 'itemId')
    @field(Array, { genericArguments: [MbChildrenNoAutoMapLineItem] })
    items: MbChildrenNoAutoMapLineItem[] = [];
}
```
