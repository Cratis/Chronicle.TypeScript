```typescript
import { eventLog, eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbEventSeqLocalEvent {
    data = '';
}

@readModel()
@fromEvent(MbEventSeqLocalEvent)
@eventLog
class MbEventSeqLocalSnapshot {
    @setFrom(MbEventSeqLocalEvent, 'data')
    data = '';
}
```
