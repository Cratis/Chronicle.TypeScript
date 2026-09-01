```typescript
import { ChronicleClient } from '@cratis/chronicle';

async function deletePersonEncryptionKey(chronicleClient: ChronicleClient): Promise<void> {
    const eventStore = await chronicleClient.getEventStore('Sales');
    await eventStore.pii.deleteEncryptionKey('person-42');
}
```
