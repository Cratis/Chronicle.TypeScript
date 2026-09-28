```typescript
import { field } from '@cratis/fundamentals';
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { ReadModelScenario } from '@cratis/chronicle/testing';

@eventType()
class PerRunScenarioEvent {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

class PerRunScenarioModel {
    @field(String) id = '';
    @field(String) name = '';
}

@projection('per-run-scenario-projection', PerRunScenarioModel)
class PerRunScenarioProjection implements IProjectionFor<PerRunScenarioModel> {
    define(builder: IProjectionBuilderFor<PerRunScenarioModel>): void {
        builder.from(PerRunScenarioEvent, from => from.set(model => model.name).to(event => event.name));
    }
}

// The catalog passed to this scenario selects its projection independently of other runs.
const perRunScenario = new ReadModelScenario(PerRunScenarioModel, {
    eventTypes: [PerRunScenarioEvent], reducers: [], projections: [PerRunScenarioProjection]
});
perRunScenario.given.forEventSource('author-1').events(new PerRunScenarioEvent('Jane Austen'));
const perRunModel = await perRunScenario.instance;
if (perRunModel?.name !== 'Jane Austen') throw new Error('Expected the per-run projection to set the name');
```
