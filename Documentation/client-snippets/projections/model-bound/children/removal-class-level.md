```typescript
import { childrenFrom, eventType, Guid, removedWith } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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

@removedWith(MbChildrenRemovalClassLineItemRemoved, 'itemId', 'orderId')
export class MbChildrenRemovalClassOrderLine {
    id: Guid = Guid.empty;
    description = '';
}

export class MbChildrenRemovalClassOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalClassLineItemAdded, 'itemId')
    @field(Array, { genericArguments: [MbChildrenRemovalClassOrderLine] }) lines: MbChildrenRemovalClassOrderLine[] = [];
}
```
