```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecConstantKeyUserJoined {
    constructor(readonly userId: string, readonly userName: string) {}
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
