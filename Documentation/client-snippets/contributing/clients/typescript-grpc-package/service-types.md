```typescript
import { EventStoresClient, NamespacesClient } from '@cratis/chronicle.contracts';

async function readAvailableNamespaces(eventStores: EventStoresClient, namespaces: NamespacesClient): Promise<string[]> {
    await eventStores.ensure({ Name: 'shopping' });
    const result = await namespaces.getNamespaces({ EventStore: 'shopping' });

    return result.items;
}
```
