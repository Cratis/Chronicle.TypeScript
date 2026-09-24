```typescript title="Initialize collections"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

export class InitialValuesAddress {
    street = '';
    city = '';
}

@eventType()
export class InitialValuesCustomerRegistered {
    constructor(readonly name: string) {}
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
