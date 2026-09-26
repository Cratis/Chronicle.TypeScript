```typescript title="Exclude a single property from convention mapping"
import { eventType, fromEvent, noAutoMap, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class NoAutoMapWorkArrangementSet {
    @field(String) readonly location: string;
    @field(Number) readonly workMode: number;

    constructor(location: string, workMode: number) {
        this.location = location;
        this.workMode = workMode;
    }
}

@eventType()
export class NoAutoMapCandidateSubmitted {
    @field(String) readonly name: string;
    @field(String) readonly location: string;

    constructor(name: string, location: string) {
        this.name = name;
        this.location = location;
    }
}

@fromEvent(NoAutoMapWorkArrangementSet)
export class NoAutoMapAssignmentSummary {
    // location is sourced only from NoAutoMapWorkArrangementSet. NoAutoMapCandidateSubmitted is
    // value-mapped (for candidateName) and also carries a location; @noAutoMap stops that location
    // from being auto-mapped over the explicit value, while every other property keeps mapping.
    @setFrom(NoAutoMapWorkArrangementSet, 'location')
    @noAutoMap
    location = '';

    @setFrom(NoAutoMapCandidateSubmitted, 'name')
    candidateName = '';
}
```
