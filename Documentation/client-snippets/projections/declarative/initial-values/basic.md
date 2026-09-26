```typescript title="Initial values"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

enum InitialValuesUserStatus {
    Inactive = 'Inactive',
    Active = 'Active'
}

@eventType()
export class InitialValuesUserCreated {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
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
