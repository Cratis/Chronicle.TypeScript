```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedClear {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedClear {
}

@fromEvent(CommandSetForNestedClear)
@clearWith(CommandClearedForNestedClear)
class CommandItemNestedClear {
    name = '';
    schema = '';
}
```
