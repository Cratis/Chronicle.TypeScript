```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ArchitectureDeclarativeItemAdded {
    @field(String) readonly category: string;

    constructor(category: string) {
        this.category = category;
    }
}

class ArchitectureDeclarativeSummary {
    category = '';
    count = 0;
}

@projection()
class ArchitectureDeclarativeSummaryProjection implements IProjectionFor<ArchitectureDeclarativeSummary> {
    define(builder: IProjectionBuilderFor<ArchitectureDeclarativeSummary>): void {
        builder.from(ArchitectureDeclarativeItemAdded, _ => _
            .usingKey(e => e.category)
            .count(m => m.count));
    }
}
```
