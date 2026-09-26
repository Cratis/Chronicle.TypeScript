```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReactorOrderPlaced {
    @field(String) readonly customerEmail: string;
    @field(Number) readonly totalAmount: number;

    constructor(customerEmail: string, totalAmount: number) {
        this.customerEmail = customerEmail;
        this.totalAmount = totalAmount;
    }
}
```
