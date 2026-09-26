```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedMultipleClear {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
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
