```typescript
import { entersOn, eventType, fromEvent, globalFor, readModel, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
class MbVariantSharedIssueCreated {
    title = '';
}

@eventType()
class MbVariantSharedPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
class MbVariantSharedTitleChanged {
    title = '';
}

class MbVariantSharedWorkItem {}

@variantOf(MbVariantSharedWorkItem, 'id')
@entersOn(MbVariantSharedIssueCreated)
@fromEvent(MbVariantSharedIssueCreated)
@readModel()
class MbVariantSharedBacklogItem {
    id = '';
    title = '';
}

@variantOf(MbVariantSharedWorkItem, 'id')
@entersOn(MbVariantSharedPullRequestCreated)
@fromEvent(MbVariantSharedPullRequestCreated)
@readModel()
class MbVariantSharedPullRequestItem {
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
class MbVariantSharedHandlers {
    @setFrom(MbVariantSharedTitleChanged, 'title')
    title = '';
}
```
