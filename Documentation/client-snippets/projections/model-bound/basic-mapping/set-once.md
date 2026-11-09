```typescript
import { eventType, Guid, setFrom, setFromContext } from '@cratis/chronicle';

@eventType()
class DocumentRevisedForSetOnce {
    title = '';
}

class SetOnceDocument {
    id: Guid = Guid.empty;

    @setFrom(DocumentRevisedForSetOnce, { eventPropertyName: 'title', setOnce: true })
    originalTitle = '';

    @setFrom(DocumentRevisedForSetOnce)
    title = '';

    @setFromContext(DocumentRevisedForSetOnce, { contextProperty: 'occurred', setOnce: true })
    created = new Date(0);
}
```
