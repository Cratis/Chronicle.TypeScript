```typescript title="Multiple set mappings"
import { eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class AccountOpenedForRename {
    constructor(readonly accountName: string) {}
}

@eventType()
class AccountRenamedForRename {
    constructor(readonly newName: string) {}
}

@readModel()
@fromEvent(AccountOpenedForRename)
@fromEvent(AccountRenamedForRename)
class RenameableAccount {
    @setFrom(AccountOpenedForRename, 'accountName')
    @setFrom(AccountRenamedForRename, 'newName')
    name = '';
}
```
