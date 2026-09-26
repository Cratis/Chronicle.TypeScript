```typescript
import { clearWith, eventType, fromEvent, Guid, nested, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class SliceCreatedForNestedComplete {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
export class CommandSetForNestedComplete {
    @field(Guid) readonly commandId: Guid;
    @field(String) readonly name: string;
    @field(String) readonly schema: string;
    @field(String) readonly rules: string;
    @field(String) readonly stateSchema: string;

    constructor(commandId: Guid, name: string, schema: string, rules: string, stateSchema: string) {
        this.commandId = commandId;
        this.name = name;
        this.schema = schema;
        this.rules = rules;
        this.stateSchema = stateSchema;
    }
}

@eventType()
export class CommandRenamedForNestedComplete {
    @field(Guid) readonly commandId: Guid;
    @field(String) readonly name: string;

    constructor(commandId: Guid, name: string) {
        this.commandId = commandId;
        this.name = name;
    }
}

@eventType()
export class CommandDefinitionUpdatedForNestedComplete {
    @field(Guid) readonly commandId: Guid;
    @field(String) readonly schema: string;
    @field(String) readonly rules: string;
    @field(String) readonly stateSchema: string;

    constructor(commandId: Guid, schema: string, rules: string, stateSchema: string) {
        this.commandId = commandId;
        this.schema = schema;
        this.rules = rules;
        this.stateSchema = stateSchema;
    }
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

    @field(CommandItemNestedComplete) @nested
    command: CommandItemNestedComplete | null = null;
}
```
