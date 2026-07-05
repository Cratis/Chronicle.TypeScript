```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class CrudComparisonCustomerRegistered {
    constructor(readonly name: string, readonly address: string) {}
}

@eventType()
class CrudComparisonAddressChanged {
    constructor(readonly address: string) {}
}
```
