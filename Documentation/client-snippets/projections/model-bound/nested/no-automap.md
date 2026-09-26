```typescript
import { clearWith, eventType, fromEvent, Guid, nested, noAutoMap, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class CommandSetForNestedNoAutoMap {
    commandName = '';
    schema = '';
}

@eventType()
export class CommandClearedForNestedNoAutoMap {}

@fromEvent(CommandSetForNestedNoAutoMap)
@clearWith(CommandClearedForNestedNoAutoMap)
@noAutoMap
export class CommandItemNestedNoAutoMap {
    @setFrom(CommandSetForNestedNoAutoMap, 'commandName')
    name = '';

    @setFrom(CommandSetForNestedNoAutoMap, 'schema')
    schema = '';
}

@fromEvent(CommandSetForNestedNoAutoMap)
export class SliceWithNestedCommandNoAutoMap {
    id: Guid = Guid.empty;

    @field(CommandItemNestedNoAutoMap) @nested
    command: CommandItemNestedNoAutoMap | null = null;
}
```
