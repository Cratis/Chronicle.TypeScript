```typescript
import { count, eventType, fromEvent, Guid, setFrom } from '@cratis/chronicle';

@eventType()
export class AggOnlyArrangementSet {
    constructor(readonly location: string) {}
}

@eventType()
export class AggOnlyCandidateSubmitted {
    constructor(readonly name: string, readonly location: string) {}
}

// AggOnlyCandidateSubmitted is subscribed only to be counted, so its identically named
// location is not auto-mapped over the value sourced from AggOnlyArrangementSet.
@fromEvent(AggOnlyArrangementSet)
export class AggOnlyAssignmentSummary {
    id: Guid = Guid.empty;

    @setFrom(AggOnlyArrangementSet, 'location')
    location = '';

    @count(AggOnlyCandidateSubmitted)
    candidateCount = 0;
}
```
