```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecVariantIssueCreated {
    title = '';
}

@eventType()
class DecVariantPullRequestCreated {
    pullRequestUrl = '';
}
```
