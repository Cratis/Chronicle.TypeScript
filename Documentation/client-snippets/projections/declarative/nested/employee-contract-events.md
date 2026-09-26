```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EmployeeHiredForNestedContractEvents {
    @field(String) readonly name: string;
    @field(String) readonly department: string;

    constructor(name: string, department: string) {
        this.name = name;
        this.department = department;
    }
}

@eventType()
class ContractStartedForNestedContractEvents {
    @field(String) readonly contractId: string;
    @field(String) readonly startDate: string;
    @field(String) readonly endDate: string;
    @field(String) readonly type: string;

    constructor(contractId: string, startDate: string, endDate: string, type: string) {
        this.contractId = contractId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.type = type;
    }
}

@eventType()
class ContractExtendedForNestedContractEvents {
    @field(String) readonly newEndDate: string;

    constructor(newEndDate: string) {
        this.newEndDate = newEndDate;
    }
}

@eventType()
class ContractEndedForNestedContractEvents {
}
```
