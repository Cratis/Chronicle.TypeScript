<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

These declarations require kernel 19.41.0 or later. Discover `PinnedOrderPlaced` and `PinnedOrderNotifications` before opening the store. The runtime examples take that initialized store; choose either a class reactor or runtime registration for the same work, not both.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor, EventGenerationDelivery, EventContext, IEventStore } from '@cratis/chronicle';

@eventType()
class PinnedOrderPlaced {
    @field(Number) amount = 0;
}

@reactor('pinned-order-notifications', undefined, EventGenerationDelivery.Pinned)
class PinnedOrderNotifications {
    pinnedOrderPlaced(event: PinnedOrderPlaced, context: EventContext): void {
        console.log(event.amount, context.eventType.generation.value, context.appendedGeneration?.value);
    }
}

async function registerPinnedCallback(store: IEventStore): Promise<void> {
    await store.reactors.register('pinned-order-callback', builder => builder
        .on(PinnedOrderPlaced, (event, context) => {
            console.log(event.amount, context.appendedGeneration?.value);
        })
        .withEventGenerationDelivery(EventGenerationDelivery.Pinned));
}

async function registerPinnedDelegate(store: IEventStore): Promise<void> {
    await store.reactors.register('pinned-order-delegate', builder => builder
        .withEventType(PinnedOrderPlaced)
        .withEventGenerationDelivery(EventGenerationDelivery.Pinned),
    async ({ content, context }) => {
        console.log(content, context.appendedGeneration?.value);
    });
}
```
