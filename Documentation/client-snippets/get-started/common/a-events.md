```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class GetStartedBookAdded {
    constructor(
        readonly title: string,
        readonly isbn: string
    ) {}
}

@eventType()
class GetStartedBookBorrowed {
    constructor(readonly memberName: string) {}
}

@eventType()
class GetStartedBookReturned {
}
```
