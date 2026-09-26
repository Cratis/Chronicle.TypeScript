```typescript title="Multiple set mappings"
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AccountOpenedForRename {
    @field(String) readonly accountName: string;

    constructor(accountName: string) {
        this.accountName = accountName;
    }
}

@eventType()
export class AccountRenamedForRename {
    @field(String) readonly newName: string;

    constructor(newName: string) {
        this.newName = newName;
    }
}

@fromEvent(AccountOpenedForRename)
@fromEvent(AccountRenamedForRename)
export class RenameableAccount {
    @setFrom(AccountOpenedForRename, 'accountName')
    @setFrom(AccountRenamedForRename, 'newName')
    name = '';
}
```
