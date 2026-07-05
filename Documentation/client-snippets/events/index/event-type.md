```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class EventsIndexEmployeeRegistered {
    constructor(
        readonly firstName: string,
        readonly lastName: string
    ) {}
}
```
