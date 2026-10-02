<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, tags } from '@cratis/chronicle';

@eventType()
class TaggingSaleRecorded {
    productId = '';
    amount = 0;
}

class TaggingSalesReport {
    productId = '';
    totalSales = 0;
}

@projection('', TaggingSalesReport)
@tags('Analytics', 'Reporting', 'Dashboard')
class TaggingSalesReportProjection implements IProjectionFor<TaggingSalesReport> {
    define(builder: IProjectionBuilderFor<TaggingSalesReport>): void {
        builder.from(TaggingSaleRecorded, from => from.add(model => model.totalSales).with(event => event.amount));
    }
}
```
