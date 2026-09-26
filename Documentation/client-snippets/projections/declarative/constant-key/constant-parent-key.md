```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecConstantKeyUserJoined {
    @field(String) readonly userId: string;
    @field(String) readonly userName: string;

    constructor(userId: string, userName: string) {
        this.userId = userId;
        this.userName = userName;
    }
}

class DecConstantKeyTeamMember {
    userId = '';
    name = '';
}

class DecConstantKeyTeam {
    members: DecConstantKeyTeamMember[] = [];
}

@projection()
class DecConstantKeyTeamActivityProjection implements IProjectionFor<DecConstantKeyTeam> {
    define(builder: IProjectionBuilderFor<DecConstantKeyTeam>): void {
        builder
            .children<DecConstantKeyTeamMember>(m => m.members, children => children
                .identifiedBy(e => e.userId)
                .from(DecConstantKeyUserJoined, _ => _
                    .usingConstantParentKey('main-team')
                    .set(m => m.name).to(e => e.userName)));
    }
}
```
