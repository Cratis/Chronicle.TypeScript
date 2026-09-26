```typescript
import { count, eventType, fromEvent, Guid, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AggOnlyArrangementSet {
    @field(String) readonly location: string;

    constructor(location: string) {
        this.location = location;
    }
}

@eventType()
export class AggOnlyCandidateSubmitted {
    @field(String) readonly name: string;
    @field(String) readonly location: string;

    constructor(name: string, location: string) {
        this.name = name;
        this.location = location;
    }
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
