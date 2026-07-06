```typescript title="Initialize collections"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

class InitialValuesAddress {
    street = '';
    city = '';
}

@eventType()
class InitialValuesCustomerRegistered {
    constructor(readonly name: string) {}
}

@readModel()
class InitialValuesCustomerRecord {
    name = '';
    addresses: InitialValuesAddress[] = [];
    tags: string[] = [];
}

@projection('', InitialValuesCustomerRecord)
class InitialValuesCustomerRecordProjection implements IProjectionFor<InitialValuesCustomerRecord> {
    define(builder: IProjectionBuilderFor<InitialValuesCustomerRecord>): void {
        builder
            .withInitialValues(() => new InitialValuesCustomerRecord())
            .from(InitialValuesCustomerRegistered);
    }
}
```
