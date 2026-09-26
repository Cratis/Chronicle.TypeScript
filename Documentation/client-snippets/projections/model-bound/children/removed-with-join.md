```typescript
import { childrenFrom, eventType, Guid, removedWithJoin } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbChildrenRemovedFeatureActivated {
    featureId: Guid = Guid.empty;
    name = '';
}

@eventType()
export class MbChildrenRemovedFeatureDeactivated {
    featureId: Guid = Guid.empty;
}

export class MbChildrenRemovedFeature {
    featureId: Guid = Guid.empty;
    name = '';
}

export class MbChildrenRemovedSubscription {
    id: Guid = Guid.empty;

    @childrenFrom(MbChildrenRemovedFeatureActivated, 'featureId', 'featureId')
    @removedWithJoin(MbChildrenRemovedFeatureDeactivated, 'featureId')
    @field(Array, { genericArguments: [MbChildrenRemovedFeature] }) features: MbChildrenRemovedFeature[] = [];
}
```
