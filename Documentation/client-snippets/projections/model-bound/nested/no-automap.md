```typescript title="Disable AutoMap on a nested type"
import { clearWith, eventType, fromEvent, noAutoMap, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CommandSetForNestedNoAutoMap {
    @field(String) readonly commandName: string;
    @field(String) readonly schema: string;

    constructor(commandName: string, schema: string) {
        this.commandName = commandName;
        this.schema = schema;
    }
}

@eventType()
class CommandClearedForNestedNoAutoMap {}

@fromEvent(CommandSetForNestedNoAutoMap)
@clearWith(CommandClearedForNestedNoAutoMap)
@noAutoMap
class CommandItemNestedNoAutoMap {
    @setFrom(CommandSetForNestedNoAutoMap, 'commandName')
    name = '';

    @setFrom(CommandSetForNestedNoAutoMap, 'schema')
    schema = '';
}
```
