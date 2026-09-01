```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecRemoveWithJoinDeveloperProjectsProjection implements IProjectionFor<DecRemoveWithJoinDeveloperProfile> {
    define(builder: IProjectionBuilderFor<DecRemoveWithJoinDeveloperProfile>): void {
        builder
            .autoMap()
            .from(DecRemoveWithJoinDeveloperOnboarded, _ => _
                .set(m => m.developerId).toEventSourceId()
                .set(m => m.onboardedAt).toEventContextProperty('occurred'))
            .children<DecRemoveWithJoinProjectAssignment>(m => m.currentProjects, children => children
                .identifiedBy(e => e.projectId)
                .autoMap()
                .from(DecRemoveWithJoinDeveloperAssignedToProject, _ => _
                    .usingParentKey(e => e.developerId)
                    .usingKey(e => e.projectId)
                    .set(m => m.assignedAt).toEventContextProperty('occurred'))
                .join(DecRemoveWithJoinProjectInitiated, _ => _
                    .on(m => m.projectId))
                .removedWith(DecRemoveWithJoinDeveloperUnassignedFromProject, _ => _
                    .usingKey(e => e.projectId))
                .removedWithJoin(DecRemoveWithJoinProjectCancelled)
                .removedWithJoin(DecRemoveWithJoinProjectCompleted));
    }
}
```
