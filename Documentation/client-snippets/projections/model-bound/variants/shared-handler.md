```typescript
import { entersOn, eventType, fromEvent, globalFor, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
export class MbVariantSharedIssueCreated {
    title = '';
}

@eventType()
export class MbVariantSharedPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
export class MbVariantSharedTitleChanged {
    title = '';
}

export class MbVariantSharedWorkItem {}

@variantOf(MbVariantSharedWorkItem, 'id')
@entersOn(MbVariantSharedIssueCreated)
@fromEvent(MbVariantSharedIssueCreated)
export class MbVariantSharedBacklogItem {
    id = '';
    title = '';
}

@variantOf(MbVariantSharedWorkItem, 'id')
@entersOn(MbVariantSharedPullRequestCreated)
@fromEvent(MbVariantSharedPullRequestCreated)
export class MbVariantSharedPullRequestItem {
    id = '';
    title = '';

    @setFrom(MbVariantSharedPullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';
}

/**
 * Declares a mapping every variant of MbVariantSharedWorkItem shares. Every variant must have a
 * title member - one that does not is a declaration error, not a silently skipped mapping. Never
 * registered as a projection on its own.
 */
@globalFor(MbVariantSharedWorkItem)
export class MbVariantSharedHandlers {
    @setFrom(MbVariantSharedTitleChanged, 'title')
    title = '';
}
```
