<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, tag } from '@cratis/chronicle';

@eventType()
class FilteringTaggedOrderPlaced {
    customerId = '';
}

class FilteringOrderReport {
    customerId = '';
}

@projection('', FilteringOrderReport)
// Sends a tag with the projection definition; does not filter received events.
// Chronicle does not store projection tags yet (Cratis/Chronicle#4512).
@tag('reporting')
class FilteringOrderReportingProjection implements IProjectionFor<FilteringOrderReport> {
    define(builder: IProjectionBuilderFor<FilteringOrderReport>): void {
        builder.from(FilteringTaggedOrderPlaced, from => from.usingKey(event => event.customerId));
    }
}
```
