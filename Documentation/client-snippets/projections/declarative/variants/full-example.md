```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecVariantFullIssueCreated {
    title = '';
}

@eventType()
class DecVariantFullPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
class DecVariantFullBuildCompleted {
    buildStatus = '';
}

/**
 * Anchors the logical identity shared by DecVariantFullBacklogItem and
 * DecVariantFullPullRequestItem. Deliberately not a read model itself.
 */
class DecVariantFullWorkItem {}

class DecVariantFullBacklogItem {
    id = '';
    title = '';
}

class DecVariantFullPullRequestItem {
    id = '';
    pullRequestUrl = '';
    buildStatus = '';
}

/** The variant an entity is in before a pull request exists for it. */
@projection()
class DecVariantFullBacklogItemProjection implements IProjectionFor<DecVariantFullBacklogItem> {
    define(builder: IProjectionBuilderFor<DecVariantFullBacklogItem>): void {
        builder
            .variantOf(DecVariantFullWorkItem, m => m.id)
            .entersOn(DecVariantFullIssueCreated);
    }
}

/**
 * The variant an entity enters once a pull request is created for it. buildStatus comes from
 * DecVariantFullBuildCompleted - an event that is NOT this variant's entering event, so the
 * builder reclassifies it into an update-only join and it can never create the row on its own.
 */
@projection()
class DecVariantFullPullRequestItemProjection implements IProjectionFor<DecVariantFullPullRequestItem> {
    define(builder: IProjectionBuilderFor<DecVariantFullPullRequestItem>): void {
        builder
            .variantOf(DecVariantFullWorkItem, m => m.id)
            .entersOn(DecVariantFullPullRequestCreated)
            .from(DecVariantFullBuildCompleted);
    }
}
```
