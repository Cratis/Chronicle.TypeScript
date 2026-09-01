```typescript title="Clear a scalar member"
import { clearWith, eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbClearingProjectNoted {
    note = '';
}

@eventType()
class MbClearingProjectNoteCleared {}

@readModel()
@fromEvent(MbClearingProjectNoted)
class MbClearingProjectNotes {
    @setFrom(MbClearingProjectNoted, 'note')
    @clearWith(MbClearingProjectNoteCleared)
    note: string | undefined = undefined;
}
```
