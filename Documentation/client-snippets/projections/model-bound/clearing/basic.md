```typescript title="Clear a scalar member"
import { clearWith, eventType, fromEvent, setFrom } from '@cratis/chronicle';

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
    note: string | undefined = undefined;
}
```
