```typescript
import { count, eventType, fromEvent, Guid, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class AggOnlyArrangementSet {
    constructor(readonly location: string) {}
}

@eventType()
class AggOnlyCandidateSubmitted {
    constructor(readonly name: string, readonly location: string) {}
}

// AggOnlyCandidateSubmitted is subscribed only to be counted, so its identically named
// location is not auto-mapped over the value sourced from AggOnlyArrangementSet.
@readModel()
@fromEvent(AggOnlyArrangementSet)
class AggOnlyAssignmentSummary {
    id: Guid = Guid.empty;

    @setFrom(AggOnlyArrangementSet, 'location')
    location = '';

    @count(AggOnlyCandidateSubmitted)
    candidateCount = 0;
}
```
