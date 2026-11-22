<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

These artifact declarations require kernel 19.41.0 or later. Discover the event, read model and reducer before opening the store. The reducer subscribes to the declared event generation; pinning asks the kernel to deliver that shape during catch-up and replay.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType, readModel, reducer, EventGenerationDelivery, EventContext } from '@cratis/chronicle';

@eventType()
class PinnedAmountAdded {
    @field(Number) amount = 0;
}

@readModel()
class PinnedTotal {
    @field(Number) amount = 0;
}

@reducer('pinned-totals', undefined, PinnedTotal, true, EventGenerationDelivery.Pinned)
class PinnedTotalsReducer {
    pinnedAmountAdded(event: PinnedAmountAdded, state: PinnedTotal | undefined, context: EventContext): PinnedTotal {
        // Unknown original generations stay undefined; the delivered generation is separate.
        console.log(context.eventType.generation.value, context.appendedGeneration?.value);
        return Object.assign(new PinnedTotal(), { amount: (state?.amount ?? 0) + event.amount });
    }
}
```
