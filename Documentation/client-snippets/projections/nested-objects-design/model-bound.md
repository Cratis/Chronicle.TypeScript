```typescript
import { clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';

@eventType()
export class NodSliceCreated {
    constructor(readonly name: string) {}
}

@eventType()
export class NodCommandSetForSlice {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
export class NodCommandClearedForSlice {
}

@fromEvent(NodCommandSetForSlice)
@clearWith(NodCommandClearedForSlice)
export class NodCommandItem {
    name = '';
    schema = '';
}

@fromEvent(NodSliceCreated)
export class NodSlice {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: NodCommandItem | null = null;
}
```
