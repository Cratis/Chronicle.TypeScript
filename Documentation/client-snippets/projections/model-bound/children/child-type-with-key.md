```typescript
import { childrenFrom, eventType, Guid } from '@cratis/chronicle';

@eventType()
export class MbChildrenChildTypeWithKeyItemAdded {
    itemId: Guid = Guid.empty;
    orderId: Guid = Guid.empty;
    productName = '';
}

// The `id` property is discovered as the child's identifier and is mapped from `itemId`
export class MbChildrenChildTypeWithKeyItem {
    id: Guid = Guid.empty;
    productName = '';
}

export class MbChildrenChildTypeWithKeyOrder {
    id: Guid = Guid.empty;

    // The options form names the child type without @field metadata, so it also works under tsx and esbuild
    @childrenFrom(MbChildrenChildTypeWithKeyItemAdded, { childType: MbChildrenChildTypeWithKeyItem, key: 'itemId', parentKey: 'orderId' })
    items: MbChildrenChildTypeWithKeyItem[] = [];
}
```
