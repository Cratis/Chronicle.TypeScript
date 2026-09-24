```typescript
import { childrenFrom, eventType, fromEvent, Guid } from '@cratis/chronicle';

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

export class MbChildrenChildFromEventDashboard {
    id: Guid = Guid.empty;
    name = '';

    @childrenFrom(MbChildrenChildFromEventConfigurationAdded, 'configurationId', undefined, 'dashboardId')
    configurations: MbChildrenChildFromEventConfiguration[] = [];
}

@fromEvent(MbChildrenChildFromEventConfigurationRenamed, { parentKey: 'dashboardId' })
export class MbChildrenChildFromEventConfiguration {
    id: Guid = Guid.empty;
    name = '';
}
```
