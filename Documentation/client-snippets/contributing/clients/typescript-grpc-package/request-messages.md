```typescript
import { EnsureEventStoreRequest, EnsureNamespaceRequest, AllNamespacesRequest } from '@cratis/chronicle.contracts';

const eventStore = EnsureEventStoreRequest.create({ Name: 'shopping' });
const namespace = EnsureNamespaceRequest.create({ EventStore: eventStore.Name, Namespace: 'tenant-one' });
const namespaces = AllNamespacesRequest.create({ EventStore: eventStore.Name });

console.log(eventStore, namespace, namespaces);
```
