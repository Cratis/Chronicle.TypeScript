```typescript
import { clearWith, eventType, fromEvent, Guid, nested, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class SliceCreatedForNestedComplete {
    constructor(readonly name: string) {}
}

@eventType()
class CommandSetForNestedComplete {
    constructor(
        readonly commandId: Guid,
        readonly name: string,
        readonly schema: string,
        readonly rules: string,
        readonly stateSchema: string
    ) {}
}

@eventType()
class CommandRenamedForNestedComplete {
    constructor(readonly commandId: Guid, readonly name: string) {}
}

@eventType()
class CommandDefinitionUpdatedForNestedComplete {
    constructor(
        readonly commandId: Guid,
        readonly schema: string,
        readonly rules: string,
        readonly stateSchema: string
    ) {}
}

@eventType()
class CommandClearedForNestedComplete {
}

@fromEvent(CommandSetForNestedComplete)
@fromEvent(CommandRenamedForNestedComplete)
@fromEvent(CommandDefinitionUpdatedForNestedComplete)
@clearWith(CommandClearedForNestedComplete)
class CommandItemNestedComplete {
    @setFrom(CommandSetForNestedComplete, 'commandId')
    id: Guid = Guid.empty;

    @setFrom(CommandSetForNestedComplete, 'name')
    @setFrom(CommandRenamedForNestedComplete, 'name')
    name = '';

    @setFrom(CommandSetForNestedComplete, 'schema')
    @setFrom(CommandDefinitionUpdatedForNestedComplete, 'schema')
    schema = '';

    @setFrom(CommandSetForNestedComplete, 'rules')
    @setFrom(CommandDefinitionUpdatedForNestedComplete, 'rules')
    rules = '';

    @setFrom(CommandSetForNestedComplete, 'stateSchema')
    @setFrom(CommandDefinitionUpdatedForNestedComplete, 'stateSchema')
    stateSchema = '';
}

@readModel()
@fromEvent(SliceCreatedForNestedComplete)
class SliceNestedComplete {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: CommandItemNestedComplete | null = null;
}
```
