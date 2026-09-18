```typescript
/**
 * Anchors the logical identity shared by DecVariantBacklogItem and DecVariantPullRequestItem.
 * Deliberately not a read model itself, and does not need a common shape with either variant.
 */
class DecVariantWorkItem {}

class DecVariantBacklogItem {
    id = '';
    title = '';
}

class DecVariantPullRequestItem {
    id = '';
    pullRequestUrl = '';
}
```
