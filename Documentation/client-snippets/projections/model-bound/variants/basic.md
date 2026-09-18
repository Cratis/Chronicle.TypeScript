```typescript
import { entersOn, eventType, fromEvent, readModel, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
class MbVariantIssueCreated {
    title = '';
}

@eventType()
class MbVariantPullRequestCreated {
    pullRequestUrl = '';
}

/**
 * Anchors the logical identity shared by every variant. It does not need to be a read model
 * itself, and it does not need a common shape with any of the variants.
 */
class MbVariantWorkItem {}

@variantOf(MbVariantWorkItem, 'id')
@entersOn(MbVariantIssueCreated)
@fromEvent(MbVariantIssueCreated)
@readModel()
class MbVariantBacklogItem {
    id = '';

    @setFrom(MbVariantIssueCreated, 'title')
    title = '';
}

@variantOf(MbVariantWorkItem, 'id')
@entersOn(MbVariantPullRequestCreated)
@fromEvent(MbVariantPullRequestCreated)
@readModel()
class MbVariantPullRequestItem {
    id = '';

    @setFrom(MbVariantPullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';
}
```
