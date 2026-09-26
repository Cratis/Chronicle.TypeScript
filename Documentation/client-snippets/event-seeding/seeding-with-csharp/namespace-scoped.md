```typescript
import { eventType, ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EvtSeedingProductCreated {
    @field(String) readonly name: string;
    @field(Number) readonly price: number;

    constructor(name: string, price: number) {
        this.name = name;
        this.price = price;
    }
}

@eventType()
class EvtSeedingOrganizationCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class EvtSeedingBillingSetUp {
    @field(String) readonly billingEmail: string;

    constructor(billingEmail: string) {
        this.billingEmail = billingEmail;
    }
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
