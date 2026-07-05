```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class MbChildrenAutoMapLineItemAdded {
    itemId: Guid = Guid.empty;
    productName = '';
    quantity = 0;
    price = 0;
}

@readModel()
class MbChildrenAutoMapOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenAutoMapLineItemAdded, 'itemId')
    items: MbChildrenAutoMapLineItem[] = [];
}

class MbChildrenAutoMapLineItem {
    id: Guid = Guid.empty;
    productName = '';   // Automatically mapped from MbChildrenAutoMapLineItemAdded.productName
    quantity = 0;        // Automatically mapped from MbChildrenAutoMapLineItemAdded.quantity
    price = 0;            // Automatically mapped from MbChildrenAutoMapLineItemAdded.price
}
```
