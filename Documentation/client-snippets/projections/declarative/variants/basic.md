```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecVariantBacklogItemProjection implements IProjectionFor<DecVariantBacklogItem> {
    define(builder: IProjectionBuilderFor<DecVariantBacklogItem>): void {
        builder
            .variantOf(DecVariantWorkItem, m => m.id)
            .entersOn(DecVariantIssueCreated);
    }
}

@projection()
class DecVariantPullRequestItemProjection implements IProjectionFor<DecVariantPullRequestItem> {
    define(builder: IProjectionBuilderFor<DecVariantPullRequestItem>): void {
        builder
            .variantOf(DecVariantWorkItem, m => m.id)
            .entersOn(DecVariantPullRequestCreated);
    }
}
```
