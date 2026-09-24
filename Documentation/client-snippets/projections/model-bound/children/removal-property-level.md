```typescript
import { childrenFrom, eventType, Guid, removedWith } from '@cratis/chronicle';

@eventType()
export class MbChildrenRemovalPropertyLineItemAdded {
    itemId: Guid = Guid.empty;
    description = '';
}

@eventType()
export class MbChildrenRemovalPropertyLineItemRemoved {
    itemId: Guid = Guid.empty;
}

export class MbChildrenRemovalPropertyOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalPropertyLineItemAdded, 'itemId')
    @removedWith(MbChildrenRemovalPropertyLineItemRemoved, 'itemId')
    lines: MbChildrenRemovalPropertyOrderLine[] = [];
}

export class MbChildrenRemovalPropertyOrderLine {
    id: Guid = Guid.empty;
    description = '';
}
```
