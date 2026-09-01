```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

// Only include this seeder's file in your development build/discovery patterns -
// TypeScript has no build-time equivalent of C#'s #if DEBUG, so keep it out of what
// ChronicleOptions.discoveryPatterns picks up for production.
@seeder()
class EvtSeedingDevelopmentSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('dev-user-1', [new EvtSeedingUserRegistered('dev@example.com', 'Dev User')]);
    }
}
```
