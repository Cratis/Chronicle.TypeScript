```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class ReactorOrderPlaced {
    constructor(
        readonly customerEmail: string,
        readonly totalAmount: number
    ) {}
}
```
