```typescript title="Initialize collections"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

export class InitialValuesAddress {
    street = '';
    city = '';
}

@eventType()
export class InitialValuesCustomerRegistered {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export class InitialValuesCustomerRecord {
    name = '';
    addresses: InitialValuesAddress[] = [];
    tags: string[] = [];
}

@projection('', InitialValuesCustomerRecord)
export class InitialValuesCustomerRecordProjection implements IProjectionFor<InitialValuesCustomerRecord> {
    define(builder: IProjectionBuilderFor<InitialValuesCustomerRecord>): void {
        builder
            .withInitialValues(() => new InitialValuesCustomerRecord())
            .from(InitialValuesCustomerRegistered);
    }
}
```
