```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DeclAggArrangementSet {
    constructor(readonly location: string) {}
}

@eventType()
class DeclAggCandidateSubmitted {
    constructor(readonly name: string, readonly location: string) {}
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
