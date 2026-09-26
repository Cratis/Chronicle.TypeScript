```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CrudComparisonCustomerRegistered {
    @field(String) readonly name: string;
    @field(String) readonly address: string;

    constructor(name: string, address: string) {
        this.name = name;
        this.address = address;
    }
}

@eventType()
class CrudComparisonAddressChanged {
    @field(String) readonly address: string;

    constructor(address: string) {
        this.address = address;
    }
}
```
