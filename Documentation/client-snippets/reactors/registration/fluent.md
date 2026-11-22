```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType('fluent-customer-registered')
class FluentCustomerRegistered {
    @field(String) name = '';
}

async function registerFluentReactor(store: IEventStore): Promise<void> {
    const definition = store.reactors.define('customer-notifications', builder => builder
        .on(FluentCustomerRegistered, async (event, context) => {
            console.log(event.name, context.eventSourceId);
        })
        .subscribe((_event, context) => { console.log(context.eventType.id.value); }));

    // Local start only; no kernel subscription acknowledgment is implied.
    await store.reactors.register(definition);
}
```
