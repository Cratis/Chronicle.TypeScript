```typescript
import { clearWith, eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedClear {
    @field(String) readonly name: string;
    @field(String) readonly schema: string;

    constructor(name: string, schema: string) {
        this.name = name;
        this.schema = schema;
    }
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
