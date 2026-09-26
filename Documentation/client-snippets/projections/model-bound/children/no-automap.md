```typescript
import { childrenFrom, eventType, Guid, noAutoMap, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenNoAutoMapLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

@noAutoMap
export class MbChildrenNoAutoMapLineItem {
    id: Guid = Guid.empty;

    // With AutoMap disabled, explicitly map each property you want to populate.
    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'productName')
    productName = '';

    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'quantity')
    quantity = 0;

    @setFrom(MbChildrenNoAutoMapLineItemAdded, 'price')
    price = 0;
}

export class MbChildrenNoAutoMapOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenNoAutoMapLineItemAdded, 'itemId')
    @field(Array, { genericArguments: [MbChildrenNoAutoMapLineItem] })
    items: MbChildrenNoAutoMapLineItem[] = [];
}
```
