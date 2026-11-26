<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# React to read-model changes

Use `@readModelReactor(Model, id?)` on a class to run application work when a registered read model changes. These are client-managed watch consumers, not durable kernel observers. Host them in a long-running client with keep-alive enabled; `skipKeepAlive` refuses registration.

## Declare a reactor

Declare any combination of `added(model, changeset)`, `modified(model, changeset)`, and `removed(model, changeset)` instance methods. Methods may be synchronous or asynchronous; inherited methods and overrides are supported. Each receives the typed model and original `ReadModelChangeset<Model>`. The class decorator supports both standard and legacy TypeScript decorators. `IReadModelReactor<Model>` is an optional compile-time contract.

The default discovery provider includes the reactor's model. Import or discover the class before requesting the event store. With a custom `IClientArtifactsProvider`, include the class in optional `readModelReactors` and the model in `readModels`. The model must be a registered root, not a nested/child model or graph element; its projection or reducer still needs to be configured. Discovery validates methods without activating the class. The default reactor ID is the class name; use a unique explicit ID if class names can collide.

See the [typed event-return example](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/client-snippets/read-models/reacting-to-changes/basic.md).

`changeType` is authoritative. If a hand-built changeset omits it, dispatch falls back to `removed ? Removed : Modified`, never `Added`. Removal passes the model payload supplied by the watcher, not a reconstructed pre-removal snapshot. `changeContext` is optional partial triggering metadata, including a bigint sequence number when available; it is not a full `EventContext`.

## Activate dependencies and handle results

Configure `ChronicleOptions.readModelReactorActivator` for constructor dependencies. It receives the constructor and a separate context containing `artifactId`, `eventStore`, `readModel`, `changeset`, `handlerName`, and `signal`. It returns the existing `ActivatedArtifact<T>` lease. Existing event reactor/reducer activation contexts and enums are unchanged; `artifactActivator` does not activate read-model reactors.

Without this option, activation uses parameterless construction. Each matching change gets one lease. The optional `run` boundary encloses the handler and returned effects, without a fabricated event invocation context. `complete` runs after processing even when processing fails, then `dispose` releases the lease. Completion errors are reported as change failures; disposal errors are logged without masking processing errors. Applications own external side effects and shared singleton lifetimes.

See [dependency activation and shutdown](https://github.com/Cratis/Chronicle.TypeScript/blob/main/Documentation/client-snippets/read-models/reacting-to-changes/dependencies.md).

Handlers may return `void`, `null`, one `EventForEventSourceId`, or an array of those wrappers. The SDK appends recognized wrappers in one atomic `appendMany` call, preserving their explicit source/stream routing and using the event log of `changeset.namespace`. Bare event returns, including bare events mixed with wrappers, fail before any append: a projection key is not necessarily an event source ID. Other unsupported return values are ignored, matching event-reactor result normalization. An unsuccessful append is a change failure.

For application-defined result handling, set `readModelReactorResultHandler(result, changeset, reactorType, eventStore, namespace)`. Returning `true` asserts that the application fully handled the result and skips SDK appending, even for a bare event. Returning `false` uses the explicit-wrapper path. This hook does not receive a fabricated `EventContext`.

## Readiness, errors, and shutdown

Event-store registration awaits all initial watcher subscription acknowledgments. Repeated registration and reconnect use the same consumers, rather than creating duplicate watchers. Partial startup failure disposes watchers already created and rejects store registration and `store.readModelReactors.completion`. Terminal watcher failures also reject `completion` and stop sibling watchers. Background completion rejection is observed and logged; applications should still await it to supervise their service.

An activation, handler, result-hook, append, or lease-completion failure affects only that change: it is logged and passed to `readModelReactorOnError(error, changeset, reactorType)`, then consumption continues. An error from `readModelReactorOnError` is logged too and is non-terminal. No automatic retry occurs; the handler or external effects might already have partially succeeded.

`store.readModelReactors.stop()` and client disposal abort watchers and prevent new dispatch. Await `completion` after stopping to drain settled in-flight leases. Cancellation is cooperative: an unending handler can keep draining pending, and an append already started cannot be undone. No returned effects start after the runtime observes cancellation. Synchronous `client.dispose()` does not await this drain.

## Delivery limits

Each class has one serial consumer; different classes may run concurrently and intentionally receive the same model's changes. Watch resumption does not replay changes missed during an outage. Transport boundaries can also duplicate observations, so handlers must be idempotent where needed. There is no initial snapshot, durable checkpoint, replay, or exactly-once guarantee. Avoid effects that repeatedly update the same watched projection unless your domain explicitly stops the loop.

Collection handlers, materialized snapshot diffing, and a read-model-reactor scenario DSL are not supported. Test readiness, actual projection changes, and effect appends against a kernel; unit specs alone cannot prove subscription ordering.
