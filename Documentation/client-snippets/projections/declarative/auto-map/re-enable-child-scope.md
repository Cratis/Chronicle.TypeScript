```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class AutoMapTeamFormed {
    constructor(readonly teamName: string) {}
}

@eventType()
class AutoMapMemberJoinedTeam {
    constructor(readonly memberId: string, readonly displayName: string) {}
}

class AutoMapTeamMember {
    memberId = '';
    displayName = '';
}

class AutoMapTeam {
    name = '';
    createdAt = new Date();
    members: AutoMapTeamMember[] = [];
}

@projection()
class AutoMapTeamProjection implements IProjectionFor<AutoMapTeam> {
    define(builder: IProjectionBuilderFor<AutoMapTeam>): void {
        builder
            .noAutoMap()
            .from(AutoMapTeamFormed, _ => _
                .set(m => m.name).to(e => e.teamName)
                .set(m => m.createdAt).toEventContextProperty('occurred'))
            .children<AutoMapTeamMember>(m => m.members, children => children
                .identifiedBy(m => m.memberId)
                .autoMap()
                .from(AutoMapMemberJoinedTeam, _ => _
                    .usingKey(e => e.memberId)));
    }
}
```
