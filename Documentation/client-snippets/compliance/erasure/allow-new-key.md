```typescript
import { ChronicleClient } from '@cratis/chronicle';

async function allowNewEncryptionKeyForPerson(chronicleClient: ChronicleClient): Promise<void> {
    const eventStore = await chronicleClient.getEventStore('Sales');
    await eventStore.pii.allowNewEncryptionKeyFor('person-42');
}
```
