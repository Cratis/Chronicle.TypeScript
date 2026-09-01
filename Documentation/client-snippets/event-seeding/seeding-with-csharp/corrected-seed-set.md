```typescript
import { IEventStore } from '@cratis/chronicle';

async function registerEvtSeedingCorrection(eventStore: IEventStore): Promise<void> {
    eventStore.seeding.for('user-123', [new EvtSeedingUserRegistered('john@example.com', 'John Doe')]);

    await eventStore.seeding.register();
}
```
