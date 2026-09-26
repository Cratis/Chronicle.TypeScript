```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EmployeeHiredWithNestedContract {
    @field(String) readonly name: string;
    @field(String) readonly department: string;

    constructor(name: string, department: string) {
        this.name = name;
        this.department = department;
    }
}

@eventType()
class ContractStartedWithNestedContract {
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
class ContractExtendedWithNestedContract {
    @field(String) readonly newEndDate: string;

    constructor(newEndDate: string) {
        this.newEndDate = newEndDate;
    }
}

@eventType()
class ContractEndedWithNestedContract {
}

class ContractForNestedEmployee {
    contractId = '';
    startDate = '';
    endDate = '';
    type = '';
}

class EmployeeWithNestedContract {
    name = '';
    department = '';
    activeContract: ContractForNestedEmployee | null = null;
}

@projection()
class EmployeeProjectionWithNestedContract implements IProjectionFor<EmployeeWithNestedContract> {
    define(builder: IProjectionBuilderFor<EmployeeWithNestedContract>): void {
        builder
            .from(EmployeeHiredWithNestedContract)
            .nested<ContractForNestedEmployee>(m => m.activeContract, contract => contract
                .from(ContractStartedWithNestedContract)
                .from(ContractExtendedWithNestedContract, b => b
                    .set(m => m.endDate).to(e => e.newEndDate))
                .clearWith(ContractEndedWithNestedContract));
    }
}
```
