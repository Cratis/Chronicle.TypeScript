```typescript
import { clearWith, eventType, fromEvent, Guid, nested, readModel } from '@cratis/chronicle';

@eventType()
class NodSliceCreated {
    constructor(readonly name: string) {}
}

@eventType()
class NodCommandSetForSlice {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class NodCommandClearedForSlice {
}

@fromEvent(NodCommandSetForSlice)
@clearWith(NodCommandClearedForSlice)
class NodCommandItem {
    name = '';
    schema = '';
}

@readModel()
@fromEvent(NodSliceCreated)
class NodSlice {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: NodCommandItem | null = null;
}
```
