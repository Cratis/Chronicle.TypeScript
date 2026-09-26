```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MigrationsCombineShippingAddressRecordedV1 {
    @field(String) readonly street: string;
    @field(String) readonly city: string;

    constructor(street: string, city: string) {
        this.street = street;
        this.city = city;
    }
}

@eventType('shipping-address-recorded', 2)
class MigrationsCombineShippingAddressRecorded {
    @field(String) readonly formattedAddress: string;

    constructor(formattedAddress: string) {
        this.formattedAddress = formattedAddress;
    }
}

@eventTypeMigration(MigrationsCombineShippingAddressRecorded, MigrationsCombineShippingAddressRecordedV1)
class MigrationsCombineShippingAddressRecordedMigration implements IEventTypeMigration<MigrationsCombineShippingAddressRecorded, MigrationsCombineShippingAddressRecordedV1> {
    upcast(builder: IEventMigrationBuilder<MigrationsCombineShippingAddressRecorded, MigrationsCombineShippingAddressRecordedV1>): void {
        builder.properties(pb => pb
            .combine('formattedAddress', ' ', 'street', 'city')); // Joins with space separator
    }

    downcast(builder: IEventMigrationBuilder<MigrationsCombineShippingAddressRecordedV1, MigrationsCombineShippingAddressRecorded>): void {
        builder.properties(pb => pb
            .split('street', 'formattedAddress', ' ', 0)
            .split('city', 'formattedAddress', ' ', 1));
    }
}
```
