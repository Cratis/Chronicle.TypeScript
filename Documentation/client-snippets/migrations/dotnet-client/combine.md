```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('dotnet-client-shipping-address-recorded', 2)
class MigrationsDotnetClientCombineShippingAddressRecorded {
    constructor(readonly fullAddress: string) {}
}

@eventType('dotnet-client-shipping-address-recorded', 1)
class MigrationsDotnetClientCombineShippingAddressRecordedV1 {
    constructor(readonly street: string, readonly city: string) {}
}

@eventTypeMigration(MigrationsDotnetClientCombineShippingAddressRecorded, MigrationsDotnetClientCombineShippingAddressRecordedV1)
class MigrationsDotnetClientCombineShippingAddressRecordedMigration implements IEventTypeMigration<MigrationsDotnetClientCombineShippingAddressRecorded, MigrationsDotnetClientCombineShippingAddressRecordedV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsDotnetClientCombineShippingAddressRecorded, MigrationsDotnetClientCombineShippingAddressRecordedV1>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .combine('fullAddress', ' ', 'street', 'city'));
    }

    downcast(builder: IEventMigrationBuilder<MigrationsDotnetClientCombineShippingAddressRecordedV1, MigrationsDotnetClientCombineShippingAddressRecorded>): void {
        builder.properties(propertyBuilder => propertyBuilder
            .split('street', 'fullAddress', ' ', 0)
            .split('city', 'fullAddress', ' ', 1));
    }
}
```
