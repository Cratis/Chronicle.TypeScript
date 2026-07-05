```typescript
import { childrenFrom, eventType, Guid, readModel, removedWith } from '@cratis/chronicle';

@eventType()
class MbChildrenRemovalPropertyLineItemAdded {
    itemId: Guid = Guid.empty;
    description = '';
}

@eventType()
class MbChildrenRemovalPropertyLineItemRemoved {
    itemId: Guid = Guid.empty;
}

@readModel()
class MbChildrenRemovalPropertyOrder {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovalPropertyLineItemAdded, 'itemId')
    @removedWith(MbChildrenRemovalPropertyLineItemRemoved, 'itemId')
    lines: MbChildrenRemovalPropertyOrderLine[] = [];
}

class MbChildrenRemovalPropertyOrderLine {
    id: Guid = Guid.empty;
    description = '';
}
```
