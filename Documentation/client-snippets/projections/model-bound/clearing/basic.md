```typescript title="Clear a scalar member"
import { clearWith, eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbClearingProjectNoted {
    note = '';
}

@eventType()
export class MbClearingProjectNoteCleared {}

@fromEvent(MbClearingProjectNoted)
export class MbClearingProjectNotes {
    @setFrom(MbClearingProjectNoted, 'note')
    @clearWith(MbClearingProjectNoteCleared)
    @field(String) note: string | undefined = undefined;
}
```
