```typescript
import { entersOn, eventType, fromEvent, readModel, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
class MbVariantUpdatingPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
class MbVariantUpdatingBuildCompleted {
    buildStatus = '';
}

class MbVariantUpdatingWorkItem {}

/**
 * buildStatus is mapped from MbVariantUpdatingBuildCompleted - an event that is NOT this variant's
 * entering event, so it is automatically reclassified into an update-only join. It can bring an
 * already-active instance up to date, but it can never create one on its own.
 */
@variantOf(MbVariantUpdatingWorkItem, 'id')
@entersOn(MbVariantUpdatingPullRequestCreated)
@fromEvent(MbVariantUpdatingPullRequestCreated)
@fromEvent(MbVariantUpdatingBuildCompleted)
@readModel()
class MbVariantUpdatingPullRequestItem {
    id = '';

    @setFrom(MbVariantUpdatingPullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';

    @setFrom(MbVariantUpdatingBuildCompleted, 'buildStatus')
    buildStatus = '';
}
```
