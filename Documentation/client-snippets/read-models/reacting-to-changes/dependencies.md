<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { ChronicleClient, ChronicleOptions, readModelReactor, ReadModelChangeset } from '@cratis/chronicle';

class DeliveryStatus {
    status = '';
}

@readModelReactor(DeliveryStatus, 'publish-delivery-status')
class PublishDeliveryStatus {
    constructor(private readonly publish: (message: string) => Promise<void>) {}

    async modified(model: DeliveryStatus, change: ReadModelChangeset<DeliveryStatus>): Promise<void> {
        await this.publish(`${change.key}: ${model.status}`);
    }
}

async function runDeliveryNotifications(connectionString: string, publish: (message: string) => Promise<void>, shutdown: Promise<void>): Promise<void> {
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
        // This example has one reactor dependency signature. A real container can resolve by type.
        readModelReactorActivator: async (type, context) => {
            console.log('Activating', context.artifactId, context.handlerName);
            return { instance: new type(publish) };
        },
        readModelReactorOnError: (error, change) => {
            console.error('Change failed; subsequent changes still run', change.key, error);
        }
    }));
    try {
        const store = await client.getEventStore('shipping');
        // Registration awaited the initial subscription acknowledgments, not a snapshot or catch-up.
        const reactors = store.readModelReactors!;
        try {
            await Promise.race([shutdown, reactors.completion]);
        } finally {
            reactors.stop();
            await reactors.completion;
        }
    } finally {
        client.dispose();
    }
}
```

`DeliveryStatus` illustrates dependency activation only; register a projection or reducer that builds it before using the service. This is not an append-to-read example. The default activator constructs reactors without arguments. To use a service container, return its resolved instance and the lease's optional `run`, `complete`, and `dispose` hooks. The SDK releases that lease, not a shared container singleton.
