---
title: Connect to Chronicle
description: Configure the TypeScript client's connection string, credentials, and TLS, and understand how it connects, reconnects, checks compatibility, and shuts down.
---

The [getting started guide](./getting-started.md) connects to a local development kernel with `ChronicleOptions.development()`. This page covers everything else: connecting to a real server, securing the connection, and knowing what the client does when the network or the kernel misbehaves.

## Connect with a connection string

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const options = ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION!);
const client = new ChronicleClient(options);
const store = await client.getEventStore('Library');
```

Keep the connection string, which carries credentials, in configuration or a secret store rather than in source code.

Creating a `ChronicleClient` does not connect. The first `getEventStore(...)` or `getEventStores()` call connects, and later calls reuse the connection.

## Inspect artifact registration

Read `store.registrationResult` for a snapshot of the latest artifact registration attempt. The SDK's `EventStore` always provides it; the member is optional on `IEventStore` so existing third-party and in-process stores remain compatible. An absent result means the implementation does not report registration, not that registration succeeded.

| State | Meaning |
| --- | --- |
| `not-run` | This store has not started artifact registration (`attemptId` is zero). |
| `in-progress` | Registration is running; pending projection declarations remain `not-run`. |
| `successful` | Artifact registration completed without throwing. Projection declarations received kernel acknowledgments. An empty projection list is valid. |
| `partially-failed` | Registration threw, but at least one projection declaration was accepted. |
| `failed` | Registration threw before any projection declaration was accepted. |

Each `projections` entry identifies a declared projection and is `not-run`, `successful` (with the actual kernel `response`), or `failed` (with the underlying `error`). The current contract returns an empty acknowledgment for a successful declaration; the SDK does not invent a richer response. `failures` lists the failed projection entries. The top-level `error` is the error thrown by artifact orchestration, including discovery or validation failures that happen before any declaration is sent.

```typescript
const store = await client.getEventStore('Library');
const report = store.registrationResult;
if (report) {
    console.log(report.attemptId, report.reason, report.state);
    for (const failure of report.failures) {
        console.log('Projection declaration failed:', failure.identifier);
        // Inspect failure.error in a controlled diagnostic context.
    }
}
```

Registration still throws the same errors, with the same retry delays and fail-fast projection ordering: projections after the first failure remain `not-run`. A first `getEventStore(...)` failure still rejects without returning a store. Retain an already acquired store to inspect later reconnect attempts. Other work already started in parallel can finish after a rejection; read the property again to see those updates. Returned snapshots do not change underneath the caller.

`attemptId` increases for every registration on that store, including reconnects; `reason` identifies why the client registered again. A new attempt replaces the previous outcomes and errors. Retain a snapshot yourself if you need history. Responses and errors are retained for explicit inspection, not sanitized for logging: do not indiscriminately serialize them to application logs.

This report describes **declaration acceptance, not observer liveness**. `observerLiveness` stays `unknown`: opening reactor or reducer streams does not acknowledge that the kernel accepted or started those observers. Use the observer-state APIs when you need running-state evidence.

## Connection string reference

```text
chronicle://[<client-id>:<client-secret>@]<host>[:<port>][,<host>[:<port>]...][/?<option>=<value>&...]
chronicle+srv://[<client-id>:<client-secret>@]<service-host>[/?<option>=<value>&...]
```

- The port defaults to `35000`. Write IPv6 addresses in brackets, such as `[::1]:35000`.
- URL-encode reserved characters in the client id, client secret, and option values.
- `chronicle+srv://` resolves the `_chronicle._tcp.<host>` DNS SRV records into a list of servers. It accepts exactly one host.

| Option | Default | Meaning |
| --- | --- | --- |
| `apiKey` | Not set | Authenticate with an API key instead of client credentials. |
| `disableTls` | `false` | `true` connects over plaintext gRPC and requests tokens over `http`. |
| `skipTlsValidation` | `true` | Accept any server certificate. The default stays `true` in this release. An explicit `false` always requires validation; an explicit `true` skips it. |
| `loadBalancer` | `least-connections` | How the client picks one server from several: `least-connections`, `round-robin`, or `random`. |
| `srvNameServer` | System resolver | IP address, with an optional port, of the DNS server used for `chronicle+srv://` lookups, such as `10.0.0.2:53`. A host name is rejected. |
| `auth` | Not set | `none` skips authentication altogether. It beats any credentials or API key in the connection string. |
| `certificatePath`, `certificatePassword` | Not set | A PKCS#12 (`.p12`/`.pfx`) file, or a PEM file with the certificate chain and private key, presented to the server for mutual TLS. `certificatePassword` unlocks either. |
| `caCertificatePath` | Not set | A PEM file with the certificate authorities the server certificate must chain to, in place of the Node.js trust store. Used only with `skipTlsValidation=false`. |
| `skipCompatibilityCheck` | `false` | Skip the server compatibility check on connect. A known-safe client and kernel skew only; it hides contract incompatibilities. The kernel version stays unknown, so batches and commits combining named tags with registered event sources throw `NamedTagsWithRegisteredEventSourceNotSupported`. |
| `skipKeepAlive` | `false` | Skip the keep-alive connection, for short-lived processes. The client cannot host reactors or reducers. |

`ChronicleOptions.fromConnectionString(connectionString, options)` also accepts these options in its second argument:

| Option | Default | Meaning |
| --- | --- | --- |
| `discoveryPatterns` | None for compiled JavaScript; `**/*.ts` and `**/*.tsx` with exclusions when the program runs from TypeScript | Glob patterns for [artifact discovery](./getting-started.md#artifact-discovery). `[]` turns it off. |
| `defaultSinkTypeId` | `WellKnownSinks.MongoDB` | Where registered read models are stored; see [Sinks](./sinks.md). |
| `clientArtifactsProvider` | The shared default provider | Supplies the event types, projections, reducers, and reactors to register. |
| `namespaceResolver` | Not set; uses the `Default` namespace | Resolves a namespace when `getEventStore` omits it; see [Resolve namespaces from application context](#resolve-namespaces-from-application-context). |
| `reactorResultHandler` | Not set | Handles values that reactors return; see [Reactors](./reactors.md). |
| `telemetry` | Event source identifiers omitted | Per-client identifier privacy; see [Observability](./observability.md#privacy-options). |
| `logger` | `diag` compatibility adapter | Per-client structured diagnostic sink; see [Observability](./observability.md#application-diagnostics). |
| `connectTimeout` | `10000` | Milliseconds the client waits for the kernel to answer the [compatibility check](#client-and-kernel-compatibility) on each new connection. Must be a whole number from 1 to 4294967295. A timeout fails that connection attempt, which is retried; it never skips the check. |
| `multiplexObservation` | `true` | Reactors and reducers share one bidirectional stream to the kernel instead of opening one each, when the kernel advertises `multiplexed-observation` in its [compatibility check](#client-and-kernel-compatibility) answer. Set `false` to open one stream per reactor and reducer. Against a kernel that does not advertise it, or with `skipCompatibilityCheck=true`, the client always opens one stream each. |
| `maxReceiveMessageSize` | `104857600` (100 MB) | Largest gRPC message, in bytes, the client accepts from the kernel. `null` leaves gRPC's own 4 MB default, which can refuse large read models. |
| `maxSendMessageSize` | `104857600` (100 MB) | Largest gRPC message, in bytes, the client sends to the kernel. `null` leaves gRPC's own default. |

`ChronicleOptions.development(options)` takes the same second argument. `ChronicleConnectionString` is exported from `@cratis/chronicle`, so you can build or inspect a connection string in code and pass it to `fromConnectionString`.

Spans always use the `cratis.chronicle.client.*` convention names. For upgrade actions, see [Telemetry naming cutoff](./observability.md#telemetry-naming-cutoff).

## Resolve namespaces from application context

For a shared client serving several tenants, configure `namespaceResolver` in `ChronicleOptions.fromConnectionString(...)` or `ChronicleOptions.development(...)`. The exported `EventStoreNamespaceResolver` callback returns a `string`, an `EventStoreNamespaceName`, or a promise of either. Without a resolver, omitting the namespace still selects `EventStoreNamespaceName.default` (`Default`).

The application owns the context and tenant selection. This example uses Node.js `AsyncLocalStorage`; the client has no HTTP-framework or claims dependency. It requires a local development kernel:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const tenantContext = new AsyncLocalStorage<string>();
const client = new ChronicleClient(ChronicleOptions.development({
    namespaceResolver: () => {
        const tenant = tenantContext.getStore();
        if (!tenant) throw new Error('A tenant context is required');
        return tenant;
    }
}));

try {
    await tenantContext.run('tenant-a', async () => {
        const store = await client.getEventStore('orders');
        console.log(store.namespace.value); // tenant-a
    });
} finally {
    client.dispose();
}
```

Call `getEventStore` inside the application's tenant context. The client calls the resolver once for every retrieval that omits the namespace, including cache hits, and awaits it before looking up the store. The resolved namespace is part of the cache key: a resolved `tenant-a` and an explicit `getEventStore('orders', 'tenant-a')` share a store. An explicit namespace always wins and bypasses the callback.

Do not keep a mutable current tenant on the shared client or in a global variable. Concurrent callbacks run in their callers' contexts; the client does not retain a resolved namespace as its default. Obtain the store for the current request rather than sharing one tenant's store with other tenants. Throw when context is missing or invalid: a thrown error, rejected promise, empty or whitespace-only name, or invalid runtime result rejects `getEventStore` without falling back to `Default`.

## Authenticate

The client supports two authentication methods. Use one per connection string.

- **Client credentials.** Put the client id and secret in the user-info part: `chronicle://my-service:<secret>@chronicle.example.com`. The client requests an OAuth access token from `/connect/token` on the server it connects to, using TLS unless `disableTls=true`, and sends it as a bearer token on every call.
- **API key.** Add `apiKey=<key>`. The client sends it as `api-key` metadata on every call.

When a connection string has both an API key and a client id and secret, the API key wins: the client sends the API key and ignores the client credentials. A client id without a secret fails, unless an API key is present, in which case the client id is ignored.

:::caution[No credentials means development credentials]
A connection string without credentials does not fail. The client falls back to the public development client id and secret, which work only against a development kernel. A server that rejects them fails the connection with `RejectedChronicleCredentials`; see [How the client connects and recovers](#how-the-client-connects-and-recovers).
:::

## Secure the connection with TLS

The client uses TLS unless the connection string sets `disableTls=true`. Chronicle serves gRPC and the token endpoint over TLS on one port.

:::danger[Validate the server certificate for any non-local server]
Set `skipTlsValidation=false` on every connection string that points at a server other than a local development kernel. `skipTlsValidation` defaults to `true` so that the development image's self-signed certificate works without configuration. With that default, the client accepts any certificate for both gRPC calls and token requests, so anyone who can intercept the connection can read the credentials and the events.
:::

When TLS is on and `skipTlsValidation` is `true`, the client logs one warning through the configured [logger](./observability.md#application-diagnostics) when the connection starts if any target host is not a loopback host (`localhost`, `127.x.x.x`, or `::1`). The warning names the host, says that certificate validation is disabled for the gRPC channel and OAuth token requests and that any certificate is accepted, and tells you to set `skipTlsValidation=false` once the server certificate is trusted. It is logged once per connection, not on each call or reconnect. The default stays `true` in this release; an explicit `skipTlsValidation=false` requires validation.
With `skipTlsValidation=false`, the server certificate must be trusted by the default Node.js and gRPC trust store, or chain to a certificate authority in the file named by `caCertificatePath`. The authority file is read whenever the option is set, so a missing or unreadable file, or one without PEM certificates, fails the connection setup even while validation is skipped.

For mutual TLS, set `certificatePath` to a PKCS#12 file or to a PEM file that holds the certificate chain and the private key. The client presents the certificate on the gRPC channel, on token requests and on the load balancer's probes. A wrong `certificatePassword`, or a key that does not belong to the certificate, fails the connection setup.

Option names are matched without regard to case, boolean options accept only `true` and `false`, and a literal `+` in a value stays a plus. Percent-encode reserved characters in the user name and password; a connection string whose user information leaks a separator into the options is rejected.

Use `disableTls=true` only when something else protects the traffic, for example a service mesh that terminates TLS. Credentials and events then cross the network unencrypted between the client and that proxy.

## Connect to several servers

List several hosts, or use `chronicle+srv://`, to connect to a clustered deployment:

```text
chronicle://my-service:<secret>@chronicle-1.internal:35000,chronicle-2.internal:35000/?skipTlsValidation=false&loadBalancer=round-robin
```

The client talks to one server at a time. It resolves SRV records again and picks a server with the `loadBalancer` strategy on every connection and reconnection attempt, so it follows membership changes. With client credentials, it requests tokens from the selected server too, so each server must serve `/connect/token`.

## How the client connects and recovers

When `getEventStore(...)` needs a connection, the client:

1. Resolves the servers and picks one.
2. Verifies that the kernel's gRPC contract is compatible with the client's contract package. See [Client and kernel compatibility](#client-and-kernel-compatibility).
3. Calls the kernel and registers a keep-alive.
4. Creates the event store if needed and registers its artifacts.

Two failures are permanent. When the kernel is incompatible, the client throws `IncompatibleChronicleServer`. When the token endpoint rejects the client credentials with an OAuth `invalid_client`, `unauthorized_client`, or `invalid_grant` error, or the kernel refuses an API key, and this repeats on three consecutive attempts, it throws `RejectedChronicleCredentials`. The repeats ride out a kernel that is still registering its clients at startup; other token-endpoint errors, such as a 403 from a proxy, keep retrying. In both cases it stops retrying and rejects every later call; fix the deployment or the connection string, then create a new client.

If one of the first three steps fails for any other reason, such as the kernel being unreachable, the client waits and tries again, indefinitely. The wait doubles from about one second up to 30 seconds, with random jitter so that many clients don't return at once. Until a connection succeeds or you dispose the client, `getEventStore(...)` neither resolves nor rejects. Once connected, a failure to register artifacts, such as a schema error, rejects `getEventStore(...)` straight away.

After connecting, the client checks the connection every five seconds and watches the kernel keep-alive. When either fails, it reconnects with the same backoff and registers the artifacts again for every event store it has handed out. A registration failure during that reconnect is logged, not thrown. Reactor and reducer observations restart after the reconnect. If `getEventStore(...)` or `getEventStores()` fails with a connection error, the client reconnects and retries the call once. Other calls, such as appends, reject with the gRPC error, and your code decides whether to retry.

When the kernel rejects a cached token as unauthenticated, for example after a key rotation, the client requests a new token and retries the call once. Observation streams are not retried within the call; they are observed again after a reconnect.

### Reactor and reducer streams

Each reactor and reducer keeps its own observation stream open to the kernel. A stream can end while the connection itself stays up: the kernel closes a cross-store stream instead of tailing it, or a busy or restarting kernel fails it. The client then opens that stream again, after a wait that depends on how the stream fared:

- After a stream that worked, it waits about two seconds. A stream has worked when it delivered events or stayed open for three minutes.
- While streams keep ending without working, the wait doubles each time, up to one minute.
- Every wait lands at random in the upper half of its current value, so many reactors and reducers whose streams ended together, for example during a kernel rollout, come back spread out instead of as one herd.

When a stream ends because the kernel no longer knows the client's connection, for example after the kernel restarted, opening the stream again cannot work. The client instead reconnects as a whole, as described above: it drops the session, connects with a new connection id, and registers every reactor and reducer again. If sessions keep being lost right after connecting, the client waits longer between these whole-client reconnects, growing with jitter, until a session stays up for 30 seconds.

These waits match the .NET client and are not configurable.

## Short-lived processes

For a CLI, script, or short-lived job, set `skipKeepAlive: true`:

```typescript
const client = new ChronicleClient(ChronicleOptions.development({ skipKeepAlive: true }));
const store = await client.getEventStore('Library');
// Append events or query the store. Dispose explicitly when you are finished.
client.dispose();
```

The connection-string alternative is `chronicle://localhost:35000?skipKeepAlive=true`. The default is `false`. Either the string or the options can enable it; an explicit `false` option does not override a `true` string value. Only the exact string value `true` enables it.

This skips the kernel keep-alive stream and the periodic connection-health watchdog. Connection and artifact discovery still happen on the first operation, unary calls still connect and retry as usual, and explicit disposal still closes resources. Event types, projections (including model-bound projections), read models, appends, and queries remain available. Read-model `watch` and `createWatcher` streams remain available too; a watch you open intentionally keeps running until cancelled or disposed. Other caller-owned streams can also keep the process alive.

Client-hosted reactors and reducers require a long-running connection. With `skipKeepAlive`, any decorated reactor or reducer in the artifact provider is refused before channel creation, load-balancer probes, compatibility checks, or registration. This includes inactive reducers. `getEventStore()` rejects with `ClientObserversRequireKeepAlive`, whose `observerKind` and `observerId` identify the observer. Host these observers in a separate client without `skipKeepAlive`. Later direct registration is refused too. This option is not a way to run a reactor in a script or to force an exit while streams are open.

Without caller-owned streams, the skipped-mode client does not keep a process alive after its pending calls finish; `dispose()` remains the recommended way to close the channel deterministically.

## Connection diagnostics

Supply `ChronicleOptions.logger` to send structured diagnostics to your application logger. Records include error types, not exception messages or stacks; see the [logging contract](./observability.md#application-diagnostics).

Without a custom logger, the client uses its OpenTelemetry `diag` adapter; this default stays after the naming migration. It discards messages until you register a diagnostics logger. Existing configuration still works:

```typescript
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
```

Failed attempts appear as `@cratis/chronicle/ChronicleClient Connection attempt failed, retrying`, with the attempt number, delay, and `error.type`/`exception.type`. gRPC failures also include numeric `rpc.grpc.status_code`, for example `14` (`UNAVAILABLE`), `16` (`UNAUTHENTICATED`), or `4` (`DEADLINE_EXCEEDED`). When a token request fails, the client logs `Failed to obtain OAuth2 token; sending RPC without authorization` with the error type and sends the call without a token, which a kernel with authentication turned off accepts. Tokens, exception messages, and stacks are not included in diagnostics.

To fail fast at startup instead of waiting forever, bound the first call and dispose the client when the time runs out:

```typescript
let timer: NodeJS.Timeout | undefined;
const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Chronicle did not respond within 30 seconds')), 30_000);
});

try {
    const store = await Promise.race([client.getEventStore('Library'), timeout]);
    // Use the store.
} catch (error) {
    client.dispose();
    throw error;
} finally {
    clearTimeout(timer);
}
```

## Client and kernel compatibility

The TypeScript client and the Chronicle kernel have separate version numbers, and the client also depends on a `@cratis/chronicle.contracts` version. None of these numbers promises which kernel versions work.

Instead, the client sends its contract descriptor to the kernel on every new connection, and the kernel reports whether it can serve it. When the kernel reports an incompatibility, or does not implement the check, the client throws `IncompatibleChronicleServer`, does not retry, and rejects every later call. Deploy a compatible kernel and create a new client. The check fails closed: there is no programmatic option to skip it, and a timeout (see `connectTimeout`) retries the connection instead of skipping the check. The only bypass is the connection-string option `skipCompatibilityCheck=true`, meant for a known-safe client and kernel skew. With the check skipped, the kernel version is unknown: batches and commits combining non-empty named tags with registered event sources throw `NamedTagsWithRegisteredEventSourceNotSupported`, even on a newer kernel.

There is no published compatibility matrix. The kernel-backed specifications run against the `cratis/chronicle:19.37.4-development` image, with `19.70.0-development` and `19.78.1-development` images for the specifications that need a newer kernel. Before you upgrade in production, test the client against the kernel version you run. [Preserve existing append routes](./migrate-append-routing.md) describes the upgrade that needs a kernel supporting kernel-owned append routing. The compatibility check does not reject an older or unrecognized kernel version when the contract is compatible. Only batch appends and transaction commits combining non-empty named tags with registered event sources require kernel 19.37.4 or later. Those operations throw `NamedTagsWithRegisteredEventSourceNotSupported` before sending when the reported version is older, unknown, or unparseable, preventing older kernels from silently losing registered routing. Other batches and single appends are unaffected. Development suffixes such as `19.37.4-development` count as that release version. A locally built kernel must report its release version (for example `19.37.4`) to allow this combination; an unstamped build reporting `1.0.0` cannot use it.

## Shut down

Create one `ChronicleClient` per process and share it. On shutdown, call `client.dispose()`. It stops the health checks and the keep-alive, ends reactor and reducer observations, and closes the channel. A disposed client rejects every later call with `ChronicleClient is disposed`, including a `getEventStore(...)` that is still waiting to connect.

Once it has disposed every client, the process can exit; the client leaves no open connections or timers behind.
