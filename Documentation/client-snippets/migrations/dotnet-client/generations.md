```typescript
import { eventType } from '@cratis/chronicle';

// Generation 2 (current) — Name has been split into FirstName and LastName
@eventType('dotnet-client-author-registered', 2)
class MigrationsDotnetClientAuthorRegistered {
    constructor(readonly firstName: string, readonly lastName: string) {}
}

// Generation 1 (original) — same id, generation 1, kept only so the migration below can
// upcast from it. It is not the "current" shape of the event any more.
@eventType('dotnet-client-author-registered', 1)
class MigrationsDotnetClientAuthorRegisteredV1 {
    constructor(readonly name: string) {}
}
```
