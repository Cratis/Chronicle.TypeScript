```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

@seeder()
class EvtSeedingUserSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder
            .for('user-123', [new EvtSeedingUserRegistered('john@example.com', 'John')])
            .forEventSource('user-456', [
                new EvtSeedingUserRegistered('jane@example.com', 'Jane'),
                new EvtSeedingEmailVerified('jane@example.com')
            ]);
    }
}
```
