```typescript
import { ChronicleClient } from '@cratis/chronicle';

class DecPassiveUserService {
    constructor(private readonly client: ChronicleClient) {}

    async getUserSummary(userId: string): Promise<DecPassiveUserSummary | null> {
        const store = await this.client.getEventStore('MyStore');
        return store.readModels.findInstanceById(DecPassiveUserSummary, userId);
    }
}
```
