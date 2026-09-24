```typescript
import { childrenFrom, eventType, Guid, removedWith } from '@cratis/chronicle';

@eventType()
export class MbChildrenRemovalClassLineItemAdded {
    itemId: Guid = Guid.empty;
    description = '';
}

@eventType()
export class MbChildrenRemovalClassLineItemRemoved {
    orderId: Guid = Guid.empty;
    itemId: Guid = Guid.empty;
}

export class MbChildrenRemovalClassOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalClassLineItemAdded, 'itemId')
    lines: MbChildrenRemovalClassOrderLine[] = [];
}

@removedWith(MbChildrenRemovalClassLineItemRemoved, 'itemId', 'orderId')
export class MbChildrenRemovalClassOrderLine {
    id: Guid = Guid.empty;
    description = '';
}
```
