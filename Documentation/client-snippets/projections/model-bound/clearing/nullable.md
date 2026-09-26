```typescript title="A member has to be able to hold no value"
import { clearWith, eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbClearingShiftPlanned {
    @field(String) readonly assignee: string;
    @field(Number) readonly hours: number;

    constructor(assignee: string, hours: number) {
        this.assignee = assignee;
        this.hours = hours;
    }
}

@eventType()
export class MbClearingShiftReleased {}

@fromEvent(MbClearingShiftPlanned)
export class MbClearingShift {
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
