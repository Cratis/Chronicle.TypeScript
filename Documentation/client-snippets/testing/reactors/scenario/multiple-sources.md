```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class TenantActivated {
    @field(String) tenantId: string;
    constructor(tenantId: string) { this.tenantId = tenantId; }
}
eventType('TenantActivated')(TenantActivated);
const synced: string[] = [];
class TenantSyncReactor {
    constructor(private readonly syncService: { syncTenant(tenantId: string): Promise<void> }) {}
    tenantActivated(event: TenantActivated): Promise<void> { return this.syncService.syncTenant(event.tenantId); }
}
reactor('TenantSyncReactor')(TenantSyncReactor);
const tenantScenario = new ReactorScenario(TenantSyncReactor, {
    artifacts: { eventTypes: [TenantActivated] }, constraints: 'disabled',
    artifactActivator: type => ({ instance: new type({ syncTenant: async (tenantId: string) => { synced.push(tenantId); } }) })
});
// Events from two different tenants, each delivered to its own source partition.
await tenantScenario.given.forEventSource('tenant-A').events(new TenantActivated('tenant-A'));
await tenantScenario.given.forEventSource('tenant-B').events(new TenantActivated('tenant-B'));
// synced contains 'tenant-A' and 'tenant-B'.
```
