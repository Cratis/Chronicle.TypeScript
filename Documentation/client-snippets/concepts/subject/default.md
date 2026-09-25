```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SubjectAuthorRegistered {
    @field(String) name: string;

    constructor(name: string) {
        this.name = name;
    }
}

class SubjectAuthorService {
    constructor(private readonly store: IEventStore) {}

    register(authorId: string, name: string) {
        // Subject defaults to authorId; encryption keys for any PII on SubjectAuthorRegistered
        // are keyed by authorId.
        return this.store.eventLog.append(authorId, new SubjectAuthorRegistered(name));
    }
}
```
