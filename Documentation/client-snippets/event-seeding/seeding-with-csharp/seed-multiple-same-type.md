```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

@seeder()
class EvtSeedingMultipleSameTypeSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('user-123', [
            new EvtSeedingUserRegistered('john@example.com', 'John'),
            new EvtSeedingUserRegistered('jane@example.com', 'Jane')
        ]);
    }
}
```
