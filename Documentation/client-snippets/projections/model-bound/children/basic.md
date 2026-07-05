```typescript
import { childrenFrom, eventType, Guid, readModel } from '@cratis/chronicle';

@eventType()
class MbChildrenLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

@readModel()
class MbChildrenOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenLineItemAdded, 'itemId')
    items: MbChildrenLineItem[] = [];
}

// The `id` property is automatically discovered as the child's key
class MbChildrenLineItem {
    id: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}
```
