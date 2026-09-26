```typescript
import { eventType, Guid, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingReuseItemAdded {
    @field(Guid) readonly itemId: Guid;
    @field(String) readonly name: string;

    constructor(itemId: Guid, name: string) {
        this.itemId = itemId;
        this.name = name;
    }
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
