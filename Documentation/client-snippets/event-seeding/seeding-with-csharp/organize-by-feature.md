```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

@seeder()
class EvtSeedingUserFeatureSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('test-user-1', [new EvtSeedingUserRegistered('test1@example.com', 'Test User 1')]);
    }
}

@seeder()
class EvtSeedingOrderFeatureSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('test-order-1', [new EvtSeedingOrderPlaced('test-user-1', 100.0)]);
    }
}
```
