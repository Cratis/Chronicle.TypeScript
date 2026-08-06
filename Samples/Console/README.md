# Chronicle TypeScript Console Sample

A runnable sample demonstrating the Chronicle TypeScript client.

## What it does

1. Appends domain events (`EmployeeHired`, `EmployeeEmailSet`, `EmployeePromoted`, `EmployeeAddressSet`, `EmployeeMoved`) to a Chronicle event store
2. Reacts to those events via `HrNotificationReactor` (logs notifications), including a reactor side effect: promoting an employee appends a `PromotionRecorded` event to a separate shared `hr-audit-log` event source, by returning an `EventForEventSourceId` from the handler instead of just logging
3. Demonstrates reducer and projection artifact discovery (`EmployeeStateReducer`, `EmployeeListProjection`, `EmployeeDetails`), including the model-bound `@count` arithmetic decorator on `EmployeeDetails.promotionCount`
4. Reads event log state back (`getTailSequenceNumber`, `hasEventsFor`, `getForEventSourceIdAndEventTypes`) and logs available namespaces
5. Demonstrates Unit of Work transactions with `eventLog.transactional` and `unitOfWorkManager.begin()`
6. Queries a reducer-backed read model through `eventStore.readModels.getInstanceById(...)`
7. Registers a discoverable `@seeder` artifact (`EmployeeSeeder`) and seeds initial employee events
8. Registers two discoverable `@constraint` artifacts: `UniqueEmployeeHire` (a unique-event-type constraint, enforced by the Kernel via a query) and `UniqueEmployeeEmail` (a `unique` constraint backed by an index collection that rejects duplicate email addresses)
9. Demonstrates compliance features with the `@pii` decorator for protecting Personally Identifiable Information
10. Registers an external HTTP service with the Chronicle Kernel via `eventStore.externalServices.register(...)`, secured with a bearer token and a custom header
11. Demonstrates `AppendResult.waitForCompletion()` to deterministically wait for observers (reducer, projections, reactor) to catch up before reading a read model
12. Demonstrates permanent, destructive redaction — both a single event (`eventLog.redact`) and an entire event source (`eventLog.redactForEventSource`) — for GDPR/compliance erasure

## Keyboard controls

Select an employee with `1`–`3`, then:

| Key | Action |
| --- | --- |
| `P` | Promote the selected employee to a new title |
| `A` | Move the selected employee to a new address |
| `E` | Set the selected employee's own (unique) email address |
| `U` | Attempt to take the next employee's email — rejected by the `UniqueEmployeeEmail` constraint |
| `R` | Read the selected employee's read-model state |
| `T` | Commit a transactional (Unit of Work) batch of events |
| `W` | Promote and wait for the read model to catch up (`AppendResult.waitForCompletion`) |
| `D` | Redact the selected employee's last email change (single-event, **destructive**) |
| `G` | Erase the selected employee entirely (GDPR erasure via `redactForEventSource`, **destructive**) |
| `L` | View the HR audit log (`PromotionRecorded` events appended as a reactor side effect) |
| `C` | Show compliance (PII) information |
| `X` | Register an external HTTP service (bearer token) |
| `H` or `?` | Show the keyboard menu |
| `Q` | Quit |

## Prerequisites

- Node.js 22+
- Yarn 4+
- A Chronicle Kernel running on `localhost:35000`

> **Tip:** The easiest way to run Chronicle locally is via Docker:
>
> ```bash
> docker run -p 35000:35000 cratis/chronicle:latest-development
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
- Reactor logs for observed events, plus an `hr-audit-log` side-effect entry for every promotion (`L` keyboard command)
- A read model confirmed consistent right after append via `waitForCompletion` (`W` keyboard command)
- Confirmation of a permanent, destructive redaction (`D`/`G` keyboard commands)
- Compliance feature information (`C` keyboard command)
- External service registration confirmation (`X` keyboard command)

## Configuration

Override the Chronicle connection string with:

```bash
CHRONICLE_CONNECTION="chronicle://myserver:35000" yarn start
```

## Project structure

```
Samples/Console/
  index.ts                         # Interactive console entry point
  employees.ts                     # Shared employee data and helpers
  telemetry.ts                     # OpenTelemetry setup
  events.ts                        # Event type declarations
  reducers.ts                      # EmployeeState reducer
  reactors.ts                      # Event-driven side effects
  seeding.ts                       # Event seeding artifact (`@seeder`)
  projections-declarative.ts       # Declarative projection artifact
  projections-model-bound.ts       # Model-bound projection artifact
  constraints.ts                   # Discoverable `@constraint` artifacts
  compliance.ts                    # Compliance feature demonstration (PII)
  externalServices.ts              # External service registration demonstration
  redaction.ts                     # Permanent, destructive redaction demonstration
```
