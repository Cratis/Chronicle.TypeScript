<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, tag, tags } from '@cratis/chronicle';

@eventType()
class TaggingKpiRecorded {
    kpi = '';
    value = 0;
}

class TaggingExecutiveDashboard {
    kpi = '';
    value = 0;
}

@projection('', TaggingExecutiveDashboard)
@tags('Analytics', 'Reporting')
@tag('Executive')
class TaggingExecutiveDashboardProjection implements IProjectionFor<TaggingExecutiveDashboard> {
    define(builder: IProjectionBuilderFor<TaggingExecutiveDashboard>): void {
        builder.from(TaggingKpiRecorded);
    }
}
```
