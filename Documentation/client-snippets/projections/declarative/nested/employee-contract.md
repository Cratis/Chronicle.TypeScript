```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class EmployeeHiredWithNestedContract {
    constructor(readonly name: string, readonly department: string) {}
}

@eventType()
class ContractStartedWithNestedContract {
    constructor(
        readonly contractId: string,
        readonly startDate: string,
        readonly endDate: string,
        readonly type: string
    ) {}
}

@eventType()
class ContractExtendedWithNestedContract {
    constructor(readonly newEndDate: string) {}
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
