```typescript
import { EnsureEventStore, EnsureNamespace, GetNamespacesRequest } from '@cratis/chronicle.contracts';

const eventStore = EnsureEventStore.create({ Name: 'shopping' });
const namespace = EnsureNamespace.create({ EventStore: eventStore.Name, Name: 'tenant-one' });
const namespaces = GetNamespacesRequest.create({ EventStore: eventStore.Name });

console.log(eventStore, namespace, namespaces);
```
