```typescript
import { eventType, Guid, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingReuseItemAdded {
    constructor(readonly itemId: Guid, readonly name: string) {}
}

class EventProcessingItem {
    itemId: Guid = Guid.empty;
    name = '';
}

class EventProcessingItemList {
    items: EventProcessingItem[] = [];
}

@reducer('', undefined, EventProcessingItemList)
class EventProcessingItemListReducer {
    eventProcessingReuseItemAdded(
        event: EventProcessingReuseItemAdded,
        current: EventProcessingItemList | undefined
    ): EventProcessingItemList {
        // Copy rather than mutate current.items directly — a held snapshot may still reference it
        const items = [...(current?.items ?? []), { itemId: event.itemId, name: event.name }];

        return { items };
    }
}
```
