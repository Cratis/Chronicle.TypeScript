```typescript
import { eventType, tag, tags } from '@cratis/chronicle';

@eventType()
@tag('analytics', 'user-action')
class TaggingUserLoggedIn {
    constructor(readonly userId: string, readonly loggedInAt: Date) {}
}

// @tags() (plural) is equivalent to @tag() — use whichever reads more naturally
@eventType()
@tags('analytics', 'user-action')
class TaggingUserLoggedInAlternate {
    constructor(readonly userId: string, readonly loggedInAt: Date) {}
}

// Mixing @tag() and @tags() on the same type merges all the tags
@eventType()
@tag('security')
@tags('audit')
class TaggingUserPasswordChanged {
    constructor(readonly userId: string, readonly changedAt: Date) {}
}
```
