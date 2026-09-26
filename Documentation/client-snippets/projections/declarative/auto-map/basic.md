```typescript title="AutoMap by convention"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AutoMapUserCreated {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class AutoMapUserRenamed {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

export class AutoMapUser {
    name = '';
    email = '';
}

@projection('', AutoMapUser)
export class AutoMapUserProjection implements IProjectionFor<AutoMapUser> {
    define(builder: IProjectionBuilderFor<AutoMapUser>): void {
        builder
            .from(AutoMapUserCreated)
            .from(AutoMapUserRenamed);
    }
}
```
