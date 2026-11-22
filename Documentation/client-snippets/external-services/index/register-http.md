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

    async registerCustomersApiWithOAuth(authority: string, clientId: string, clientSecret: string): Promise<void> {
        await this.store.externalServices.register('CustomersApiOAuth', builder => builder
            .http('https://api.example.com')
            .withOAuth(authority, clientId, clientSecret, 'customers.read customers.write')
            .withHeader('X-Tenant', 'acme'));
    }
}
```
