```typescript
import { childrenFrom, eventType, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

// The `id` property is automatically discovered as the child's key
export class MbChildrenLineItem {
    id: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

export class MbChildrenOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenLineItemAdded, 'itemId')
    @field(Array, { genericArguments: [MbChildrenLineItem] }) items: MbChildrenLineItem[] = [];
}
```
