```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecVariantUpdatingPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
class DecVariantUpdatingBuildCompleted {
    buildStatus = '';
}

class DecVariantUpdatingWorkItem {}

class DecVariantUpdatingPullRequestItem {
    id = '';
    pullRequestUrl = '';
    buildStatus = '';
}

/**
 * .from(DecVariantUpdatingBuildCompleted) is declared exactly like an ordinary multi-event
 * projection. Because that event is NOT the one named with entersOn, the builder automatically
 * reclassifies it into an update-only join on the variant's own key when the definition is built -
 * it can bring an already-active instance up to date, but it can never create one on its own.
 */
@projection()
class DecVariantUpdatingPullRequestItemProjection implements IProjectionFor<DecVariantUpdatingPullRequestItem> {
    define(builder: IProjectionBuilderFor<DecVariantUpdatingPullRequestItem>): void {
        builder
            .variantOf(DecVariantUpdatingWorkItem, m => m.id)
            .entersOn(DecVariantUpdatingPullRequestCreated)
            .from(DecVariantUpdatingBuildCompleted);
    }
}
```
