```typescript
import { EventStoresClient, NamespacesClient } from '@cratis/chronicle.contracts';

async function readAvailableNamespaces(eventStores: EventStoresClient, namespaces: NamespacesClient): Promise<string[]> {
    await eventStores.ensureEventStore({ Name: 'shopping' });

    // Queries stream results so they can also be observed; one-shot callers take the first result.
    for await (const result of namespaces.allNamespaces({ EventStore: 'shopping' })) {
        return result.Data;
    }

    return [];
}
```
