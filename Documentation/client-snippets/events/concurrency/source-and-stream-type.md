```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyAccountSettingsUpdated {
    @field(String) readonly settings: string;

    constructor(settings: string) {
        this.settings = settings;
    }
}

class ConcurrencyAccountManagementService {
    constructor(private readonly eventLog: IEventLog) {}

    async updateAccountSettings(accountId: string, settings: string): Promise<void> {
        await this.eventLog.appendMany([{
            eventSourceId: accountId,
            event: new ConcurrencyAccountSettingsUpdated(settings),
            eventSourceType: 'BankAccount',
            eventStreamType: 'AccountManagement'
        }], {
            concurrencyScope: {
                sequenceNumber: 10n,
                eventSourceType: 'BankAccount',
                eventStreamType: 'AccountManagement'
            }
        });
    }
}
```
