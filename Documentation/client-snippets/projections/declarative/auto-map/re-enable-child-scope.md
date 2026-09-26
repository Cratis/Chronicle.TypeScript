```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class AutoMapTeamFormed {
    @field(String) readonly teamName: string;

    constructor(teamName: string) {
        this.teamName = teamName;
    }
}

@eventType()
class AutoMapMemberJoinedTeam {
    @field(String) readonly memberId: string;
    @field(String) readonly displayName: string;

    constructor(memberId: string, displayName: string) {
        this.memberId = memberId;
        this.displayName = displayName;
    }
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
