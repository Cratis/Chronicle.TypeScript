```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventStore, reactor } from '@cratis/chronicle';

@reactor('customer-notifications')
class ManagedNotifications {}

async function inspectAndReplayReactor(eventStore: IEventStore): Promise<void> {
    // Targets the event sequence the reactor declares, or the event log when it declares none.
    const state = await eventStore.reactors.getStateFor(ManagedNotifications);
    console.log(`Subscribed: ${state.isSubscribed}, running state: ${state.runningState}, next event: ${state.nextEventSequenceNumber.value}`);

    const replay = await eventStore.reactors.replay(ManagedNotifications);
    if (!replay.started) {
        // Chronicle did not start a job, for example because the reactor is unknown or not replayable.
        console.log('No replay was started.');
        return;
    }

    // A started job is acceptance, not completion; observe progress with getStateFor.
    console.log(`Replay job ${replay.jobId} started.`);
}
```
