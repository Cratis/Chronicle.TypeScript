```typescript
import { childrenFrom, eventType, Guid, readModel, removedWithJoin } from '@cratis/chronicle';

@eventType()
class MbChildrenRemovedFeatureActivated {
    featureId: Guid = Guid.empty;
    name = '';
}

@eventType()
class MbChildrenRemovedFeatureDeactivated {
    featureId: Guid = Guid.empty;
}

@readModel()
class MbChildrenRemovedSubscription {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovedFeatureActivated, 'featureId', 'featureId')
    @removedWithJoin(MbChildrenRemovedFeatureDeactivated, 'featureId')
    features: MbChildrenRemovedFeature[] = [];
}

class MbChildrenRemovedFeature {
    featureId: Guid = Guid.empty;
    name = '';
}
```
