```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType('delegate-customer-registered')
class DelegateCustomerRegistered {
    @field(String) name = '';
}

async function registerDelegateReactor(store: IEventStore): Promise<void> {
    await store.reactors.register('customer-audit', builder => builder
        .withEventType(DelegateCustomerRegistered)
        .onEventSequence('audit')
        .notReplayable(), async (event, signal) => {
        if (signal.aborted) return;
        console.log(event.content, event.context.sequenceNumber);
    }); // Local start, not a kernel acknowledgment. Callback completion acknowledges the event separately.
}
```
