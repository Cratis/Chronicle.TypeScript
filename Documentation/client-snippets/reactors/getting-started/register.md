```typescript
import { IEventStore } from '@cratis/chronicle';

class ReactorRegistration {
    async register(store: IEventStore): Promise<void> {
        await store.reactors.register();
    }
}
```
