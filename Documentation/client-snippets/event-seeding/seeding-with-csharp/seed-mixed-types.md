```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

@seeder()
class EvtSeedingMixedTypesSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.forEventSource('user-123', [
            new EvtSeedingUserRegistered('john@example.com', 'John'),
            new EvtSeedingEmailVerified('john@example.com'),
            new EvtSeedingProfileUpdated('John Doe')
        ]);
    }
}
```
