```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventTypeMigration, IEventMigrationBuilder, IEventTypeMigration } from '@cratis/chronicle';

class LegacyOrderDetails {
    @field(Number) status = 0;
}

class CurrentOrderDetails {
    @field(String) status = '';
    @field(String) note = '';
}

@eventType('nested-order-opened', 1)
class NestedOrderOpenedV1 {
    @field(LegacyOrderDetails) details = new LegacyOrderDetails();
}

@eventType('nested-order-opened', 2)
class NestedOrderOpenedV2 {
    @field(CurrentOrderDetails) details = new CurrentOrderDetails();
}

@eventTypeMigration(NestedOrderOpenedV2, NestedOrderOpenedV1)
class NestedOrderOpenedMigration implements IEventTypeMigration<NestedOrderOpenedV2, NestedOrderOpenedV1> {
    upcast(builder: IEventMigrationBuilder<NestedOrderOpenedV2, NestedOrderOpenedV1>): void {
        builder.properties(properties => properties
            .mapValues('details.status', 'details.status', [{ from: 0, to: 'open' }])
            .defaultValue('details.note', 'No note'));
    }

    downcast(builder: IEventMigrationBuilder<NestedOrderOpenedV1, NestedOrderOpenedV2>): void {
        builder.properties(properties => properties
            .mapValues('details.status', 'details.status', [{ from: 'open', to: 0 }]));
    }
}
```
