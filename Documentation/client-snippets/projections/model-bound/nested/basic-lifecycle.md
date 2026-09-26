```typescript
import { clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class CommandSetForNestedBasic {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
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

    @field(CommandItemNestedBasic) @nested
    command: CommandItemNestedBasic | null = null;
}
```
