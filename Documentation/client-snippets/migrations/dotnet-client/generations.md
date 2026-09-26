```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

// Generation 2 (current) — Name has been split into FirstName and LastName
@eventType('dotnet-client-author-registered', 2)
class MigrationsDotnetClientAuthorRegistered {
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;

    constructor(firstName: string, lastName: string) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

// Generation 1 (original) — same id, generation 1, kept only so the migration below can
// upcast from it. It is not the "current" shape of the event any more.
@eventType('dotnet-client-author-registered', 1)
class MigrationsDotnetClientAuthorRegisteredV1 {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}
```
