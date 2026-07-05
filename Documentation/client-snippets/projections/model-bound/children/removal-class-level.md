```typescript
import { childrenFrom, eventType, Guid, readModel, removedWith } from '@cratis/chronicle';

@eventType()
class MbChildrenRemovalClassLineItemAdded {
    itemId: Guid = Guid.empty;
    description = '';
}

@eventType()
class MbChildrenRemovalClassLineItemRemoved {
    orderId: Guid = Guid.empty;
    itemId: Guid = Guid.empty;
}

@readModel()
class MbChildrenRemovalClassOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalClassLineItemAdded, 'itemId')
    lines: MbChildrenRemovalClassOrderLine[] = [];
}

@removedWith(MbChildrenRemovalClassLineItemRemoved, 'itemId', 'orderId')
class MbChildrenRemovalClassOrderLine {
    id: Guid = Guid.empty;
    description = '';
}
```
