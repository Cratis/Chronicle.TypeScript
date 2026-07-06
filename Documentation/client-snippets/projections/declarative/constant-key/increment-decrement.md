```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecConstantKeyUserLoggedIn {
}

@eventType()
class DecConstantKeyUserLoggedOut {
}

class DecConstantKeySiteStatistics {
    activeSessions = 0;
}

@projection()
class DecConstantKeySiteStatisticsProjection implements IProjectionFor<DecConstantKeySiteStatistics> {
    define(builder: IProjectionBuilderFor<DecConstantKeySiteStatistics>): void {
        builder
            .from(DecConstantKeyUserLoggedIn, _ => _
                .usingConstantKey('site')
                .increment(m => m.activeSessions))
            .from(DecConstantKeyUserLoggedOut, _ => _
                .usingConstantKey('site')
                .decrement(m => m.activeSessions));
    }
}
```
