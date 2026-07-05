```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class BookAdded {
    constructor(
        readonly title: string,
        readonly isbn: string
    ) {}
}
```
