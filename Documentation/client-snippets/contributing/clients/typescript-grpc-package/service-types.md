```typescript
import { EventStoresClient, NamespacesClient } from '@cratis/chronicle.contracts';

async function readAvailableNamespaces(eventStores: EventStoresClient, namespaces: NamespacesClient): Promise<string[]> {
    await eventStores.ensureEventStore({ Name: 'shopping' });

    const result = await namespaces.allNamespaces({ EventStore: 'shopping' });
    return result.Data.map(namespace => namespace.Name);
}
```
