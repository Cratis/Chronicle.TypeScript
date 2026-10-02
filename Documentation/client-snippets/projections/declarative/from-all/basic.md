<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use fluent `fromAll(...)` to update a projection for every event type, including
those not declared with `from(...)`. It creates a read model keyed by event source
ID even for an otherwise unrelated event. Mappings also apply to child projections.
Use `fromEvery(...)` instead when only subscribed events should update the model.

```typescript title="Declarative FromAll"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class UserCreatedDeclarativeAll {
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(name: string, email: string) {
        this.name = name;
        this.email = email;
    }
}

@eventType()
export class UserEmailChangedDeclarativeAll {
    @field(String) readonly email: string;

    constructor(email: string) {
        this.email = email;
    }
}

export class UserProfileDeclarativeAll {
    name = '';
    email = '';
    lastUpdated = new Date();
}

@projection('', UserProfileDeclarativeAll)
export class UserProfileDeclarativeAllProjection implements IProjectionFor<UserProfileDeclarativeAll> {
    define(builder: IProjectionBuilderFor<UserProfileDeclarativeAll>): void {
        builder
            .from(UserCreatedDeclarativeAll)
            .from(UserEmailChangedDeclarativeAll)
            .fromAll(all => all
                .set(model => model.lastUpdated)
                .toEventContextProperty('occurred'));
    }
}
```
