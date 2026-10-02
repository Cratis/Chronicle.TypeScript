<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, tag } from '@cratis/chronicle';

@eventType()
class TaggingOrderPlaced {
    orderId = '';
}

@eventType()
class TaggingItemAddedToOrder {
    amount = 0;
}

class TaggingOrderAnalytics {
    orderId = '';
    totalAmount = 0;
}

@projection('', TaggingOrderAnalytics)
@tag('Analytics')
class TaggingOrderAnalyticsProjection implements IProjectionFor<TaggingOrderAnalytics> {
    define(builder: IProjectionBuilderFor<TaggingOrderAnalytics>): void {
        builder.from(TaggingOrderPlaced)
            .from(TaggingItemAddedToOrder, from => from.add(model => model.totalAmount).with(event => event.amount));
    }
}
```
