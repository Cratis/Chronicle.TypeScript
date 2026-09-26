```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecConstantKeyPageViewed {
    @field(String) readonly pageUrl: string;

    constructor(pageUrl: string) {
        this.pageUrl = pageUrl;
    }
}

@eventType()
class DecConstantKeyButtonClicked {
    @field(String) readonly buttonId: string;

    constructor(buttonId: string) {
        this.buttonId = buttonId;
    }
}

@eventType()
class DecConstantKeyFormSubmitted {
    @field(String) readonly formId: string;

    constructor(formId: string) {
        this.formId = formId;
    }
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
