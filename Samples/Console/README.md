# Chronicle TypeScript Console Sample

A runnable sample demonstrating the Chronicle TypeScript client.

## What it does

1. Appends three domain events (`EmployeeHired`, `EmployeePromoted`, `EmployeeMoved`) to a Chronicle event store
2. Reacts to those events via `HrNotificationReactor` (logs notifications)
3. Demonstrates reducer and projection artifact discovery (`EmployeeStateReducer`, `EmployeeListProjection`, `EmployeeDetails`)
4. Reads event log state back (`getTailSequenceNumber`, `hasEventsFor`) and logs available namespaces
5. Demonstrates Unit of Work transactions with `eventLog.transactional` and `unitOfWorkManager.begin()`
6. Queries a reducer-backed read model through `eventStore.readModels.getInstanceById(...)`
7. Registers a discoverable `@seeder` artifact (`EmployeeSeeder`) and seeds initial employee events
8. Demonstrates compliance features with `@pii` decorator for protecting Personal Identifiable Information

## Prerequisites

- Node.js 22+
- Yarn 4+
- A Chronicle Kernel running on `localhost:35000`

> **Tip:** The easiest way to run Chronicle locally is via Docker:
>
> ```bash
> docker run -p 35000:35000 -p 8080:8080 cratis/chronicle:latest-development
> ```

## Running

```bash
cd Samples/Console
yarn install
docker compose up -d
yarn start
```

You should see output with:

- A Chronicle connection log
- Event appends for hire, promotion, and relocation
- Read-model lookups for the selected employee (`R` keyboard command)
- Transactional staged appends committed as one unit (`T` keyboard command)
- Seeder status output for initial employees
- Event log tail/has-events information
- Reactor logs for observed events
- Compliance feature information (`C` keyboard command)

## Configuration

Override the Chronicle connection string with:

```bash
CHRONICLE_CONNECTION="chronicle://myserver:35000" yarn start
```

## Project structure

```
Samples/Console/
  index.ts                         # Demo scenario entry point
  telemetry.ts                     # OpenTelemetry setup
  events.ts                        # Event type declarations
  reducers.ts                      # EmployeeState reducer
  reactors.ts                      # Event-driven side effects
  seeding.ts                       # Event seeding artifact (`@seeder`)
  projections-declarative.ts       # Declarative projection artifact
  projections-model-bound.ts       # Model-bound projection artifact
  constraints.ts                   # Constraint registration request
  compliance.ts                    # Compliance feature demonstration (PII)
```
