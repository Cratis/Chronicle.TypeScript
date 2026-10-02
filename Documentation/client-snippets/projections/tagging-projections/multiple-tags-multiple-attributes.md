<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, tag } from '@cratis/chronicle';

@eventType()
class TaggingAuditEntryRecorded {
    entryId = '';
    category = '';
}

class TaggingComplianceReport {
    entryId = '';
    category = '';
}

@projection('', TaggingComplianceReport)
@tag('Analytics')
@tag('Compliance')
@tag('Auditing')
class TaggingComplianceReportProjection implements IProjectionFor<TaggingComplianceReport> {
    define(builder: IProjectionBuilderFor<TaggingComplianceReport>): void {
        builder.from(TaggingAuditEntryRecorded);
    }
}
```
