```typescript title="Initial values"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

enum InitialValuesUserStatus {
    Inactive = 'Inactive',
    Active = 'Active'
}

@eventType()
export class InitialValuesUserCreated {
    constructor(readonly name: string, readonly email: string) {}
}

export class InitialValuesUserProfile {
    name = 'Unknown user';
    email = '';
    status = InitialValuesUserStatus.Inactive;
    createdAt = new Date(0);
    lastLogin: Date | null = null;
    loginCount = 0;
    isVerified = false;
}

@projection('', InitialValuesUserProfile)
export class InitialValuesUserProfileProjection implements IProjectionFor<InitialValuesUserProfile> {
    define(builder: IProjectionBuilderFor<InitialValuesUserProfile>): void {
        builder
            .withInitialValues(() => new InitialValuesUserProfile())
            .from(InitialValuesUserCreated, _ => _
                .set(m => m.status).toValue(InitialValuesUserStatus.Active)
                .set(m => m.createdAt).toEventContextProperty('occurred'));
    }
}
```
