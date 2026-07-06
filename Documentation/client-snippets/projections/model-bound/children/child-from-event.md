```typescript
import { childrenFrom, eventType, fromEvent, Guid, readModel } from '@cratis/chronicle';

@eventType()
class MbChildrenChildFromEventConfigurationAdded {
    dashboardId: Guid = Guid.empty;
    configurationId: Guid = Guid.empty;
    name = '';
}

@eventType()
class MbChildrenChildFromEventConfigurationRenamed {
    dashboardId: Guid = Guid.empty;
    id: Guid = Guid.empty;
    name = '';
}

@readModel()
class MbChildrenChildFromEventDashboard {
    id: Guid = Guid.empty;
    name = '';

    @childrenFrom(MbChildrenChildFromEventConfigurationAdded, 'configurationId', undefined, 'dashboardId')
    configurations: MbChildrenChildFromEventConfiguration[] = [];
}

@fromEvent(MbChildrenChildFromEventConfigurationRenamed, { parentKey: 'dashboardId' })
class MbChildrenChildFromEventConfiguration {
    id: Guid = Guid.empty;
    name = '';
}
```
