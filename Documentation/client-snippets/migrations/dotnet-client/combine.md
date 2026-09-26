```typescript
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType('dotnet-client-shipping-address-recorded', 2)
class MigrationsDotnetClientCombineShippingAddressRecorded {
    @field(String) readonly fullAddress: string;

    constructor(fullAddress: string) {
        this.fullAddress = fullAddress;
    }
}

@eventType('dotnet-client-shipping-address-recorded', 1)
class MigrationsDotnetClientCombineShippingAddressRecordedV1 {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string, city: string) {
        this.street = street;
        this.city = city;
    }
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
