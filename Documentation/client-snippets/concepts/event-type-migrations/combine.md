```typescript
import { eventType, eventTypeMigration, IEventTypeMigration, IEventMigrationBuilder } from '@cratis/chronicle';

@eventType()
class MigrationsCombineShippingAddressRecordedV1 {
    constructor(
        readonly street: string,
        readonly city: string
    ) {}
}

@eventType('shipping-address-recorded', 2)
class MigrationsCombineShippingAddressRecorded {
    constructor(readonly formattedAddress: string) {}
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
