```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DeclAggArrangementSet {
    @field(String) readonly location: string;

    constructor(location: string) {
        this.location = location;
    }
}

@eventType()
class DeclAggCandidateSubmitted {
    @field(String) readonly name: string;
    @field(String) readonly location: string;

    constructor(name: string, location: string) {
        this.name = name;
        this.location = location;
    }
}

class DeclAggAssignmentSummary {
    location = '';
    candidateCount = 0;
}

@projection()
class DeclAggAssignmentProjection implements IProjectionFor<DeclAggAssignmentSummary> {
    define(builder: IProjectionBuilderFor<DeclAggAssignmentSummary>): void {
        builder
            .from(DeclAggArrangementSet)
            .from(DeclAggCandidateSubmitted, _ => _
                .count(m => m.candidateCount));
    }
}
```
