```typescript
import { IEventStore } from '@cratis/chronicle';

class ExternalServicesIndexRegisterPostgresql {
    constructor(
        private readonly store: IEventStore,
        private readonly password: string
    ) {}

    async registerCustomersDb(): Promise<void> {
        await this.store.externalServices.register('CustomersDb', builder => builder
            .postgreSql('db.example.com', 'customers', 'postgres', this.password, 5432));
    }
}
```
