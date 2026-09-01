```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class EmployeeHiredForNestedContractEvents {
    constructor(readonly name: string, readonly department: string) {}
}

@eventType()
class ContractStartedForNestedContractEvents {
    constructor(
        readonly contractId: string,
        readonly startDate: string,
        readonly endDate: string,
        readonly type: string
    ) {}
}

@eventType()
class ContractExtendedForNestedContractEvents {
    constructor(readonly newEndDate: string) {}
}

@eventType()
class ContractEndedForNestedContractEvents {
}
```
