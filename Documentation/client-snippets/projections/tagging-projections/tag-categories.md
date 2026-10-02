<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

```typescript
import { IProjectionBuilderFor, IProjectionFor, projection, tag } from '@cratis/chronicle';

class TaggingCategoryExamples {
    id = '';
}

@projection('', TaggingCategoryExamples)
// By domain
@tag('Sales', 'Inventory', 'Customer')
// By purpose
@tag('Analytics', 'Reporting', 'Dashboard', 'Search')
// By stakeholder
@tag('Executive', 'Operations', 'Finance')
// By consistency model
@tag('Immediate', 'Eventual')
// By data type
@tag('Aggregates', 'Lists', 'Details')
class TaggingCategoryExamplesProjection implements IProjectionFor<TaggingCategoryExamples> {
    define(_builder: IProjectionBuilderFor<TaggingCategoryExamples>): void {}
}
```
