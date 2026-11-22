```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

@eventType('one-way-order-opened', 1)
class OneWayOrderOpenedV1 {
    @field(Number) status = 0;
}

@eventType('one-way-order-opened', 2)
class OneWayOrderOpenedV2 {
    @field(String) status = '';
}

@eventTypeMigration(OneWayOrderOpenedV2, OneWayOrderOpenedV1)
class OneWayOrderOpenedMigration implements IEventTypeMigration<OneWayOrderOpenedV2, OneWayOrderOpenedV1> {
    upcast(builder: IEventMigrationBuilder<OneWayOrderOpenedV2, OneWayOrderOpenedV1>): void {
        builder.properties(properties => properties.mapValues('status', 'status', [
            { from: 0, to: 'open' },
            { from: 1, to: 'closed' }
        ]));
    }

    // Directions are independent; no inverse map is inferred.
    downcast(_builder: IEventMigrationBuilder<OneWayOrderOpenedV1, OneWayOrderOpenedV2>): void {}
}
```
