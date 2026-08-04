```typescript
import { IEventStore } from '@cratis/chronicle';

class ExternalServicesIndexRegisterHttp {
    constructor(
        private readonly store: IEventStore,
        private readonly token: string
    ) {}

    async registerCustomersApi(): Promise<void> {
        await this.store.externalServices.register('CustomersApi', builder => builder
            .http('https://api.example.com')
            .withBearerToken(this.token)
            .withHeader('X-Tenant', 'acme'));
    }
}
```
