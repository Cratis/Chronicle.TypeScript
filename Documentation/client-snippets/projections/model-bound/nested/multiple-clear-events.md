```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedMultipleClear {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedMultipleClear {
}

@eventType()
class SliceArchivedForNestedMultipleClear {
}

@fromEvent(CommandSetForNestedMultipleClear)
@clearWith(CommandClearedForNestedMultipleClear)
@clearWith(SliceArchivedForNestedMultipleClear)
class CommandItemNestedMultipleClear {
    name = '';
    schema = '';
}
```
