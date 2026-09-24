```typescript
import { eventLog, eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class MbEventSeqLocalEvent {
    data = '';
}

@fromEvent(MbEventSeqLocalEvent)
@eventLog
export class MbEventSeqLocalSnapshot {
    @setFrom(MbEventSeqLocalEvent, 'data')
    data = '';
}
```
