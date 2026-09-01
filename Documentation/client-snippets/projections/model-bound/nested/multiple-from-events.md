```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedMultipleFrom {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandRenamedForNestedMultipleFrom {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSchemaUpdatedForNestedMultipleFrom {
    constructor(readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedMultipleFrom {
}

@fromEvent(CommandSetForNestedMultipleFrom)
@fromEvent(CommandRenamedForNestedMultipleFrom)
@fromEvent(CommandSchemaUpdatedForNestedMultipleFrom)
@clearWith(CommandClearedForNestedMultipleFrom)
class CommandItemNestedMultipleFrom {
    name = '';
    schema = '';
}
```
