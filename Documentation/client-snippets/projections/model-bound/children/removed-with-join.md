```typescript
import { childrenFrom, eventType, Guid, removedWithJoin } from '@cratis/chronicle';

@eventType()
export class MbChildrenRemovedFeatureActivated {
    featureId: Guid = Guid.empty;
    name = '';
}

@eventType()
export class MbChildrenRemovedFeatureDeactivated {
    featureId: Guid = Guid.empty;
}

export class MbChildrenRemovedSubscription {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovedFeatureActivated, 'featureId', 'featureId')
    @removedWithJoin(MbChildrenRemovedFeatureDeactivated, 'featureId')
    features: MbChildrenRemovedFeature[] = [];
}

export class MbChildrenRemovedFeature {
    featureId: Guid = Guid.empty;
    name = '';
}
```
