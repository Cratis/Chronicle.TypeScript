```typescript
import { clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class NodSliceCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
export class NodCommandSetForSlice {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
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

    @field(NodCommandItem) @nested
    command: NodCommandItem | null = null;
}
```
