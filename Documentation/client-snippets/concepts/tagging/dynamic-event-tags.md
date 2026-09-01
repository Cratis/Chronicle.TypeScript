```typescript
import { IEventStore } from '@cratis/chronicle';

class TaggingUserLoginService {
    constructor(private readonly store: IEventStore) {}

    // The event will end up with four tags: ['analytics', 'user-action', 'production', 'critical']
    async recordLogin(eventSourceId: string): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new TaggingUserLoggedIn('user123', new Date()),
            { tags: ['production', 'critical'] });
    }
}
```
