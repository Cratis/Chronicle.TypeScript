```typescript title="Multiple set mappings"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class AccountOpenedForRename {
    constructor(readonly accountName: string) {}
}

@eventType()
export class AccountRenamedForRename {
    constructor(readonly newName: string) {}
}

@fromEvent(AccountOpenedForRename)
@fromEvent(AccountRenamedForRename)
export class RenameableAccount {
    @setFrom(AccountOpenedForRename, 'accountName')
    @setFrom(AccountRenamedForRename, 'newName')
    name = '';
}
```
