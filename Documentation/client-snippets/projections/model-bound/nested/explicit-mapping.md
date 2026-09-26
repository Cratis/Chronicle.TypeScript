```typescript
import { clearWith, eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedExplicit {
    @field(String) readonly commandName: string;
    @field(String) readonly jsonSchema: string;

    constructor(commandName: string, jsonSchema: string) {
        this.commandName = commandName;
        this.jsonSchema = jsonSchema;
    }
}

@eventType()
class CommandSchemaUpdatedForNestedExplicit {
    @field(String) readonly updatedSchema: string;

    constructor(updatedSchema: string) {
        this.updatedSchema = updatedSchema;
    }
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
