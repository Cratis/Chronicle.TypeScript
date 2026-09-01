```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecConstantKeyPageViewed {
    constructor(readonly pageUrl: string) {}
}

@eventType()
class DecConstantKeyButtonClicked {
    constructor(readonly buttonId: string) {}
}

@eventType()
class DecConstantKeyFormSubmitted {
    constructor(readonly formId: string) {}
}

class DecConstantKeyEngagementMetrics {
    pageViews = 0;
    buttonClicks = 0;
    formSubmissions = 0;
}

@projection()
class DecConstantKeyEngagementMetricsProjection implements IProjectionFor<DecConstantKeyEngagementMetrics> {
    define(builder: IProjectionBuilderFor<DecConstantKeyEngagementMetrics>): void {
        builder
            .from(DecConstantKeyPageViewed, _ => _
                .usingConstantKey('metrics')
                .count(m => m.pageViews))
            .from(DecConstantKeyButtonClicked, _ => _
                .usingConstantKey('metrics')
                .count(m => m.buttonClicks))
            .from(DecConstantKeyFormSubmitted, _ => _
                .usingConstantKey('metrics')
                .count(m => m.formSubmissions));
    }
}
```
