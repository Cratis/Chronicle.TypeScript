# Read Models

Use `eventStore.readModels` to query, watch, and dehydrate read model instances that are produced by projections or reducers.

## Get a Single Read Model

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { EmployeeState } from '../Samples/Console/reducers';

const client = new ChronicleClient(ChronicleOptions.development());
const store = await client.getEventStore('TestStore');

const employee = await store.readModels.getInstanceById(EmployeeState, 'a0000001-0000-0000-0000-000000000000');
console.log(employee.title);
```

## Get All Read Model Instances

```typescript
const employees = await store.readModels.getInstances(EmployeeState);
console.log(employees.length);
```

## Watch for Changes

```typescript
for await (const changeset of store.readModels.watch(EmployeeState)) {
    console.log(changeset.key, changeset.readModel.title, changeset.removed);
}
```

## Notes

- The read model type must be discoverable by Chronicle, just like projections and reducers.
- Reducer-backed read models should be declared on the `@reducer(..., readModelType)` decorator when the reducer class name differs from the read model type.
- Read models are registered automatically when an event store connects and registers artifacts.
