```typescript
import { field } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider, eventType, fromEvent } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class TestingScenarioRegisteredShipment {
    @field(String) carrier: string;
    constructor(carrier: string) { this.carrier = carrier; }
}

@fromEvent(TestingScenarioRegisteredShipment)
class TestingScenarioRegisteredDelivery {
    @field(String) id = '';
    @field(String) carrier = '';
}

// The same discovered artifacts that the client uses for registration.
const registeredArtifacts = DefaultClientArtifactsProvider.default;
if (!registeredArtifacts.eventTypes.includes(TestingScenarioRegisteredShipment)) {
    throw new Error('Expected the registered event type');
}
const registeredScenario = new ReadModelScenario(TestingScenarioRegisteredDelivery, registeredArtifacts);
registeredScenario.given.forEventSource('shipment-1').events(new TestingScenarioRegisteredShipment('FedEx'));
const registeredDelivery = await registeredScenario.instance;
if (registeredDelivery?.carrier !== 'FedEx') throw new Error('Expected the registered projection');
```
