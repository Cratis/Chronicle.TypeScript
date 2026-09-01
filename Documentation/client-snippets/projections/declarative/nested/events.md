```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class SliceCreatedForNestedEvents {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetForNestedEvents {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedEvents {
}
```
