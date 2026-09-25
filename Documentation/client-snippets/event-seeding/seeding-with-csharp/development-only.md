```typescript
import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

// TypeScript has no build-time equivalent of C#'s #if DEBUG: import this seeder's module only
// in development, and exclude it from ChronicleOptions.discoveryPatterns in production.
@seeder()
class EvtSeedingDevelopmentSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder.for('dev-user-1', [new EvtSeedingUserRegistered('dev@example.com', 'Dev User')]);
    }
}
```
