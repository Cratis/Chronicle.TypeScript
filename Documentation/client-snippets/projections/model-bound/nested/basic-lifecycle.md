```typescript
import { clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';

@eventType()
export class CommandSetForNestedBasic {
    constructor(readonly name: string, readonly schema: string) {}
}

@eventType()
export class CommandClearedForNestedBasic {
}

@fromEvent(CommandSetForNestedBasic)
@clearWith(CommandClearedForNestedBasic)
export class CommandItemNestedBasic {
    name = '';
    schema = '';
}

@fromEvent(CommandSetForNestedBasic)
export class SliceWithNestedCommandBasic {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: CommandItemNestedBasic | null = null;
}
```
