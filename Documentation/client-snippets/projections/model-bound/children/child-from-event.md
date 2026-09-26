```typescript
import { childrenFrom, eventType, fromEvent, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenChildFromEventConfigurationAdded {
    dashboardId: Guid = Guid.empty;
    configurationId: Guid = Guid.empty;
    name = '';
}

@eventType()
export class MbChildrenChildFromEventConfigurationRenamed {
    dashboardId: Guid = Guid.empty;
    id: Guid = Guid.empty;
    name = '';
}

@fromEvent(MbChildrenChildFromEventConfigurationRenamed, { parentKey: 'dashboardId' })
export class MbChildrenChildFromEventConfiguration {
    id: Guid = Guid.empty;
    name = '';
}

export class MbChildrenChildFromEventDashboard {
    id: Guid = Guid.empty;
    name = '';

    @childrenFrom(MbChildrenChildFromEventConfigurationAdded, 'configurationId', undefined, 'dashboardId')
    @field(Array, { genericArguments: [MbChildrenChildFromEventConfiguration] }) configurations: MbChildrenChildFromEventConfiguration[] = [];
}
```
