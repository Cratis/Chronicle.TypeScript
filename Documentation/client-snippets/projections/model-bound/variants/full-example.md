```typescript
import { entersOn, eventType, fromEvent, globalFor, setFrom, variantOf } from '@cratis/chronicle';

@eventType()
export class MbVariantFullIssueCreated {
    title = '';
}

@eventType()
export class MbVariantFullPullRequestCreated {
    pullRequestUrl = '';
}

@eventType()
export class MbVariantFullBuildCompleted {
    buildStatus = '';
}

@eventType()
export class MbVariantFullTitleChanged {
    title = '';
}

/**
 * Anchors the logical identity shared by MbVariantFullBacklogItem and MbVariantFullPullRequestItem.
 * Deliberately not a read model itself.
 */
export class MbVariantFullWorkItem {}

/** The variant an entity is in before a pull request exists for it. */
@variantOf(MbVariantFullWorkItem, 'id')
@entersOn(MbVariantFullIssueCreated)
@fromEvent(MbVariantFullIssueCreated)
export class MbVariantFullBacklogItem {
    id = '';
    title = '';
}

/**
 * The variant an entity enters once a pull request is created for it. buildStatus is mapped from
 * MbVariantFullBuildCompleted - an event that is NOT this variant's entering event, so it becomes
 * an update-only join and can never create the row on its own.
 */
@variantOf(MbVariantFullWorkItem, 'id')
@entersOn(MbVariantFullPullRequestCreated)
@fromEvent(MbVariantFullPullRequestCreated)
@fromEvent(MbVariantFullBuildCompleted)
export class MbVariantFullPullRequestItem {
    id = '';
    title = '';

    @setFrom(MbVariantFullPullRequestCreated, 'pullRequestUrl')
    pullRequestUrl = '';

    @setFrom(MbVariantFullBuildCompleted, 'buildStatus')
    buildStatus = '';
}

/** Declares a mapping every variant of MbVariantFullWorkItem shares. */
@globalFor(MbVariantFullWorkItem)
export class MbVariantFullSharedHandlers {
    @setFrom(MbVariantFullTitleChanged, 'title')
    title = '';
}
```
