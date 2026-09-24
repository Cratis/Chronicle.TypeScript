```typescript
import { clearWith, eventType, fromEvent, Guid, nested, setFrom } from '@cratis/chronicle';

@eventType()
export class SliceCreatedForNestedComplete {
    constructor(readonly name: string) {}
}

@eventType()
export class CommandSetForNestedComplete {
    constructor(
        readonly commandId: Guid,
        readonly name: string,
        readonly schema: string,
        readonly rules: string,
        readonly stateSchema: string
    ) {}
}

@eventType()
export class CommandRenamedForNestedComplete {
    constructor(readonly commandId: Guid, readonly name: string) {}
}

@eventType()
export class CommandDefinitionUpdatedForNestedComplete {
    constructor(
        readonly commandId: Guid,
        readonly schema: string,
        readonly rules: string,
        readonly stateSchema: string
    ) {}
}

@eventType()
export class CommandClearedForNestedComplete {
}

@fromEvent(CommandSetForNestedComplete)
@fromEvent(CommandRenamedForNestedComplete)
@fromEvent(CommandDefinitionUpdatedForNestedComplete)
@clearWith(CommandClearedForNestedComplete)
export class CommandItemNestedComplete {
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

@fromEvent(SliceCreatedForNestedComplete)
export class SliceNestedComplete {
    id: Guid = Guid.empty;
    name = '';

    @nested
    command: CommandItemNestedComplete | null = null;
}
```
