```typescript title="A member has to be able to hold no value"
import { clearWith, eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbClearingShiftPlanned {
    constructor(
        readonly assignee: string,
        readonly hours: number
    ) {}
}

@eventType()
class MbClearingShiftReleased {}

@readModel()
@fromEvent(MbClearingShiftPlanned)
class MbClearingShift {
    // Optional, so "nobody is assigned" is a state the member can actually hold.
    @setFrom(MbClearingShiftPlanned, 'assignee')
    @clearWith(MbClearingShiftReleased)
    assignee: string | undefined = undefined;

    // Optional for the same reason: 0 hours is a number of hours, not the absence of one.
    @setFrom(MbClearingShiftPlanned, 'hours')
    @clearWith(MbClearingShiftReleased)
    hours: number | undefined = undefined;
}
```
