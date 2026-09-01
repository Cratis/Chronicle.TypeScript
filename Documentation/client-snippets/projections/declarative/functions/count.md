```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecFunctionsUserLoggedIn {
    constructor(readonly username: string) {}
}

@eventType()
class DecFunctionsUserPerformedAction {
    constructor(readonly username: string, readonly actionType: string) {}
}

class DecFunctionsUserActivity {
    username = '';
    loginCount = 0;
    actionCount = 0;
}

@projection()
class DecFunctionsUserActivityProjection implements IProjectionFor<DecFunctionsUserActivity> {
    define(builder: IProjectionBuilderFor<DecFunctionsUserActivity>): void {
        builder
            .autoMap()
            .from(DecFunctionsUserLoggedIn, _ => _
                .count(m => m.loginCount))
            .from(DecFunctionsUserPerformedAction, _ => _
                .count(m => m.actionCount));
    }
}
```
