```typescript
import { entersOn, eventType, fromEvent, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
export class MbVariantIssueCreated {
    title = '';
}

@eventType()
export class MbVariantPullRequestCreated {
    pullRequestUrl = '';
}

/**
 * Anchors the logical identity shared by every variant. It does not need to be a read model
 * itself, and it does not need a common shape with any of the variants.
 */
export class MbVariantWorkItem {}

@variantOf(MbVariantWorkItem, 'id')
@entersOn(MbVariantIssueCreated)
@fromEvent(MbVariantIssueCreated)
export class MbVariantBacklogItem {
    id = '';

    @setFrom(MbVariantIssueCreated, 'title')
    title = '';
}

@variantOf(MbVariantWorkItem, 'id')
@entersOn(MbVariantPullRequestCreated)
@fromEvent(MbVariantPullRequestCreated)
export class MbVariantPullRequestItem {
    id = '';

    @setFrom(MbVariantPullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';
}
```
