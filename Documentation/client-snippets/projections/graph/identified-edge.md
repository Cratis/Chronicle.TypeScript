```typescript
import { count, edge, edgeFrom, edgeSource, edgeTarget, eventType, graph, graphKey, node, nodeFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class PlaceVisited {
    @field(String) readonly personId: string;
    @field(String) readonly placeId: string;
    @field(String) readonly visitId: string;

    constructor(personId: string, placeId: string, visitId: string) {
        this.personId = personId;
        this.placeId = placeId;
        this.visitId = visitId;
    }
}

@graph('Places')
@node()
@nodeFrom(PlaceVisited, { key: 'personId' })
export class Visitor {
    @graphKey() personId = '';
}

@graph('Places')
@node()
@nodeFrom(PlaceVisited, { key: 'placeId' })
export class Place {
    @graphKey() placeId = '';
}

@graph('Places')
@edge('VISITED')
@edgeFrom(PlaceVisited, { sourceKey: 'personId', targetKey: 'placeId', identity: 'visitId' })
export class Visited {
    @edgeSource(Visitor) personId = '';
    @edgeTarget(Place) placeId = '';
    @graphKey() visitId = '';
    @count(PlaceVisited) times = 0;
}
```
