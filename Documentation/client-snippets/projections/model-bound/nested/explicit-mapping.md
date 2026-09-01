```typescript
import { clearWith, eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
class CommandSetForNestedExplicit {
    constructor(readonly commandName: string, readonly jsonSchema: string) {}
}

@eventType()
class CommandSchemaUpdatedForNestedExplicit {
    constructor(readonly updatedSchema: string) {}
}

@eventType()
class CommandClearedForNestedExplicit {
}

@fromEvent(CommandSetForNestedExplicit)
@fromEvent(CommandSchemaUpdatedForNestedExplicit)
@clearWith(CommandClearedForNestedExplicit)
class CommandItemNestedExplicit {
    @setFrom(CommandSetForNestedExplicit, 'commandName')
    name = '';

    @setFrom(CommandSetForNestedExplicit, 'jsonSchema')
    @setFrom(CommandSchemaUpdatedForNestedExplicit, 'updatedSchema')
    schema = '';
}
```
