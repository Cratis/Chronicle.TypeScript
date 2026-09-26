```typescript
import { eventType, tag, tags } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
@tag('analytics', 'user-action')
class TaggingUserLoggedIn {
    @field(String) readonly userId: string;
    @field(Date) readonly loggedInAt: Date;

    constructor(userId: string, loggedInAt: Date) {
        this.userId = userId;
        this.loggedInAt = loggedInAt;
    }
}

// @tags() (plural) is equivalent to @tag() — use whichever reads more naturally
@eventType()
@tags('analytics', 'user-action')
class TaggingUserLoggedInAlternate {
    @field(String) readonly userId: string;
    @field(Date) readonly loggedInAt: Date;

    constructor(userId: string, loggedInAt: Date) {
        this.userId = userId;
        this.loggedInAt = loggedInAt;
    }
}

// Mixing @tag() and @tags() on the same type merges all the tags
@eventType()
@tag('security')
@tags('audit')
class TaggingUserPasswordChanged {
    @field(String) readonly userId: string;
    @field(Date) readonly changedAt: Date;

    constructor(userId: string, changedAt: Date) {
        this.userId = userId;
        this.changedAt = changedAt;
    }
}
```
