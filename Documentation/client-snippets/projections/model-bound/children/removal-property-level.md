```typescript
import { childrenFrom, eventType, Guid, removedWith } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenRemovalPropertyLineItemAdded {
    itemId: Guid = Guid.empty;
    description = '';
}

@eventType()
export class MbChildrenRemovalPropertyLineItemRemoved {
    itemId: Guid = Guid.empty;
}

export class MbChildrenRemovalPropertyOrderLine {
    id: Guid = Guid.empty;
    description = '';
}

export class MbChildrenRemovalPropertyOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalPropertyLineItemAdded, 'itemId')
    @removedWith(MbChildrenRemovalPropertyLineItemRemoved, 'itemId')
    @field(Array, { genericArguments: [MbChildrenRemovalPropertyOrderLine] }) lines: MbChildrenRemovalPropertyOrderLine[] = [];
}
```
