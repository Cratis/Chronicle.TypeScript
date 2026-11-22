```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventStore } from '@cratis/chronicle';

async function waitForReactorThenRemove(store: IEventStore, signal: AbortSignal): Promise<void> {
    // Independent readiness query; can observe an existing subscription, not just a new registration.
    await store.reactors.waitTillSubscribed('customer-notifications', { timeout: 5000, signal });

    // Local stop and removal from reconnect eligibility; does not wait for in-flight user callbacks.
    await store.reactors.unregister('customer-notifications');
}
```
