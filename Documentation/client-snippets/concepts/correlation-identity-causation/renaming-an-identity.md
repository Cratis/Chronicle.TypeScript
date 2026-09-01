```typescript
import { IEventStore } from '@cratis/chronicle';

async function renameAnIdentity(eventStore: IEventStore): Promise<void> {
    await eventStore.identities.rename('subject-42', 'Jane Austen');
}
```
