```typescript
import { eventType, ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';

@eventType()
class EvtSeedingProductCreated {
    constructor(readonly name: string, readonly price: number) {}
}

@eventType()
class EvtSeedingOrganizationCreated {
    constructor(readonly name: string) {}
}

@eventType()
class EvtSeedingBillingSetUp {
    constructor(readonly billingEmail: string) {}
}

@seeder()
class EvtSeedingTenantSeeding implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        // Global seed data — applied to every namespace
        builder.for('product-1', [new EvtSeedingProductCreated('Laptop', 1299.0)]);

        // Namespace-scoped seed data — applied only to the "acme" namespace
        builder.forNamespace('acme')
            .for('user-1', [new EvtSeedingUserRegistered('admin@acme.com', 'Acme Admin')]);

        // A second namespace with different seed data
        builder.forNamespace('contoso')
            .for('user-1', [new EvtSeedingUserRegistered('admin@contoso.com', 'Contoso Admin')])
            .forEventSource('org-1', [
                new EvtSeedingOrganizationCreated('Contoso'),
                new EvtSeedingBillingSetUp('contoso@billing.com')
            ]);
    }
}
```
