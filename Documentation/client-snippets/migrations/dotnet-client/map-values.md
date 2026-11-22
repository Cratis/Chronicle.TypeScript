```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

// Match the numbers serialized in the payload, not enum member names.
enum LegacyOrderStatus { Open = 0, Closed = 1 }

@eventType('value-map-order-opened', 1)
class ValueMapOrderOpenedV1 {
    @field(Number) status = LegacyOrderStatus.Open;
}

@eventType('value-map-order-opened', 2)
class ValueMapOrderOpenedV2 {
    @field(String) status = '';
}

@eventTypeMigration(ValueMapOrderOpenedV2, ValueMapOrderOpenedV1)
class ValueMapOrderOpenedMigration implements IEventTypeMigration<ValueMapOrderOpenedV2, ValueMapOrderOpenedV1> {
    upcast(builder: IEventMigrationBuilder<ValueMapOrderOpenedV2, ValueMapOrderOpenedV1>): void {
        builder.properties(properties => properties.mapValues('status', 'status', [
            { from: LegacyOrderStatus.Open, to: 'open' },
            { from: LegacyOrderStatus.Closed, to: 'closed' }
        ]));
    }

    downcast(builder: IEventMigrationBuilder<ValueMapOrderOpenedV1, ValueMapOrderOpenedV2>): void {
        builder.properties(properties => properties.mapValues('status', 'status', [
            { from: 'open', to: LegacyOrderStatus.Open },
            { from: 'closed', to: LegacyOrderStatus.Closed }
        ]));
    }
}
```
