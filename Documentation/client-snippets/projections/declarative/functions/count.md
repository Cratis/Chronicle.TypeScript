```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecFunctionsUserLoggedIn {
    @field(String) readonly username: string;

    constructor(username: string) {
        this.username = username;
    }
}

@eventType()
class DecFunctionsUserPerformedAction {
    @field(String) readonly username: string;
    @field(String) readonly actionType: string;

    constructor(username: string, actionType: string) {
        this.username = username;
        this.actionType = actionType;
    }
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
