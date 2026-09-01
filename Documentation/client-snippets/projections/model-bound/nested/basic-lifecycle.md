```typescript
import { clearWith, eventType, fromEvent, Guid, nested, readModel } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedBasic {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
class CommandClearedForNestedBasic {
}

@fromEvent(CommandSetForNestedBasic)
@clearWith(CommandClearedForNestedBasic)
class CommandItemNestedBasic {
    name = '';
    schema = '';
}

@readModel()
@fromEvent(CommandSetForNestedBasic)
class SliceWithNestedCommandBasic {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: CommandItemNestedBasic | null = null;
}
```
