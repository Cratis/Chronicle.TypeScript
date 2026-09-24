```typescript title="Exclude a single property from convention mapping"
import { eventType, fromEvent, noAutoMap, setFrom } from '@cratis/chronicle';

@eventType()
export class NoAutoMapWorkArrangementSet {
    constructor(
        readonly location: string,
        readonly workMode: number
    ) {}
}

@eventType()
export class NoAutoMapCandidateSubmitted {
    constructor(
        readonly name: string,
        readonly location: string
    ) {}
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
