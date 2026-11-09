```typescript
import { eventType, graph, graphKey, increment, decrement, node, nodeFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class TeamFormed {
    @field(String) readonly teamId: string;
    @field(String) readonly name: string;

    constructor(teamId: string, name: string) {
        this.teamId = teamId;
        this.name = name;
    }
}

@eventType()
export class TeamMemberJoined {
    @field(String) readonly teamId: string;

    constructor(teamId: string) {
        this.teamId = teamId;
    }
}

@eventType()
export class TeamMemberLeft {
    @field(String) readonly teamId: string;

    constructor(teamId: string) {
        this.teamId = teamId;
    }
}

@graph('Teams')
@node()
@nodeFrom(TeamFormed, { key: 'teamId' })
@nodeFrom(TeamMemberJoined, { key: 'teamId' })
@nodeFrom(TeamMemberLeft, { key: 'teamId' })
export class Team {
    @graphKey() teamId = '';
    name = '';
    @increment(TeamMemberJoined) @decrement(TeamMemberLeft) memberCount = 0;
}
```
