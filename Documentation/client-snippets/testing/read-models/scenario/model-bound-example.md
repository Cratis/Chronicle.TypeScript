```typescript
import { field } from '@cratis/fundamentals';
import { eventType, fromEvent } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingScenarioShipmentDispatched {
    @field(String) carrier: string;
    constructor(carrier: string) { this.carrier = carrier; }
}

@eventType()
class TestingScenarioShipmentDelivered {
    @field(String) deliveredAt: string;
    constructor(deliveredAt: string) { this.deliveredAt = deliveredAt; }
}

@fromEvent(TestingScenarioShipmentDispatched)
@fromEvent(TestingScenarioShipmentDelivered)
class TestingScenarioDeliveryStatus {
    @field(String) id = '';
    @field(String) carrier = '';
    @field(String) deliveredAt = '';
}

const deliveryScenario = new ReadModelScenario(TestingScenarioDeliveryStatus);
deliveryScenario.given.forEventSource('shipment-1').events(
    new TestingScenarioShipmentDispatched('FedEx'), new TestingScenarioShipmentDelivered('2026-06-01')
);
const deliveryStatus = await deliveryScenario.instance;
if (deliveryStatus?.carrier !== 'FedEx' || deliveryStatus.deliveredAt !== '2026-06-01') {
    throw new Error('Expected dispatched and delivered status');
}
```
