```typescript
import { EventContext, reducer } from '@cratis/chronicle';

class TaggingUserAnalytics {
    loginCount = 0;
    criticalLoginCount = 0;
}

@reducer('', undefined, TaggingUserAnalytics)
class TaggingUserAnalyticsReducer {
    taggingUserLoggedIn(
        event: TaggingUserLoggedIn,
        current: TaggingUserAnalytics | undefined,
        context: EventContext
    ): TaggingUserAnalytics {
        const analytics = current ?? new TaggingUserAnalytics();

        // Access tags from the event context
        const isCritical = context.tags.some(tag => tag.value === 'critical');

        return {
            loginCount: analytics.loginCount + 1,
            criticalLoginCount: analytics.criticalLoginCount + (isCritical ? 1 : 0)
        };
    }
}
```
