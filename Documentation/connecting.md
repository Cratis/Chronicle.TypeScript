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
| `skipTlsValidation` | `true` | Accept any server certificate. Set to `false` to validate the certificate. |
| `loadBalancer` | `least-connections` | How the client picks one server from several: `least-connections`, `round-robin`, or `random`. |
| `srvNameServer` | System resolver | IP address, with an optional port, of the DNS server used for `chronicle+srv://` lookups, such as `10.0.0.2:53`. A host name is rejected. |
| `certificatePath`, `certificatePassword` | Not set | Accepted for connection-string compatibility with other clients. The TypeScript client does not use them. |

`ChronicleOptions.fromConnectionString(connectionString, options)` also accepts these options in its second argument:

| Option | Default | Meaning |
| --- | --- | --- |
| `discoveryPatterns` | None for compiled JavaScript; `**/*.ts` with exclusions when the program runs from TypeScript | Glob patterns for [artifact discovery](./getting-started.md#artifact-discovery). `[]` turns it off. |
| `defaultSinkTypeId` | `WellKnownSinks.MongoDB` | Where registered read models are stored; see [Sinks](./sinks.md). |
| `clientArtifactsProvider` | The shared default provider | Supplies the event types, projections, reducers, and reactors to register. |
| `reactorResultHandler` | Not set | Handles values that reactors return; see [Reactors](./reactors.md). |

`ChronicleOptions.development(options)` takes the same second argument.

## Authenticate

The client supports two authentication methods. Use one per connection string.

- **Client credentials.** Put the client id and secret in the user-info part: `chronicle://my-service:<secret>@chronicle.example.com`. The client requests an OAuth access token from `/connect/token` on the server it connects to, using TLS unless `disableTls=true`, and sends it as a bearer token on every call.
- **API key.** Add `apiKey=<key>`. The client sends it as `api-key` metadata on every call.

A connection string with a client id and secret and an API key fails. A client id without a secret fails too, unless an API key is present, in which case the client id is ignored.

:::caution[No credentials means development credentials]
A connection string without credentials does not fail. The client falls back to the public development client id and secret, which work only against a development kernel. A server that rejects them fails the connection with `RejectedChronicleCredentials`; see [How the client connects and recovers](#how-the-client-connects-and-recovers).
:::

## Secure the connection with TLS

The client uses TLS unless the connection string sets `disableTls=true`. Chronicle serves gRPC and the token endpoint over TLS on one port.

:::danger[Validate the server certificate outside local development]
`skipTlsValidation` defaults to `true` so that the development image's self-signed certificate works without configuration. With that default, the client accepts any certificate for both gRPC calls and token requests, so anyone who can intercept the connection can read the credentials and the events. Add `skipTlsValidation=false` to every connection string that points at a shared or production server.
:::

With `skipTlsValidation=false`, the server certificate must be trusted by the default Node.js and gRPC trust store. The TypeScript client has no option to supply a custom certificate authority bundle or a client certificate.

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

Two failures are permanent. When the kernel is incompatible, the client throws `IncompatibleChronicleServer`. When the token endpoint rejects the credentials (HTTP 400, 401, or 403) and the kernel then refuses the call as unauthenticated, it throws `RejectedChronicleCredentials`. In both cases it stops retrying and rejects every later call; fix the deployment or the connection string, then create a new client.

If one of the first three steps fails for any other reason, such as the kernel being unreachable, the client waits and tries again, indefinitely. The wait doubles from about one second up to 30 seconds, with random jitter so that many clients don't return at once. Until a connection succeeds or you dispose the client, `getEventStore(...)` neither resolves nor rejects. Once connected, a failure to register artifacts, such as a schema error, rejects `getEventStore(...)` straight away.

After connecting, the client checks the connection every five seconds and watches the kernel keep-alive. When either fails, it reconnects with the same backoff and registers the artifacts again for every event store it has handed out. A registration failure during that reconnect is logged, not thrown. Reactor and reducer observations restart after the reconnect. If `getEventStore(...)` or `getEventStores()` fails with a connection error, the client reconnects and retries the call once. Other calls, such as appends, reject with the gRPC error, and your code decides whether to retry.

## Connection diagnostics

The client logs through the OpenTelemetry diagnostics API, which discards messages until you register a logger. Install `@opentelemetry/api` and register one before you create the client:

```typescript
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
```

Failed attempts then appear as `@cratis/chronicle/ChronicleClient Connection attempt failed, retrying` with the attempt number, the delay, and the error, for example `CheckCompatibility UNAVAILABLE: No connection established. Last error: Error: connect ECONNREFUSED 127.0.0.1:35000`. When a token request fails, the client logs `Failed to obtain OAuth2 token; sending RPC without authorization` with the token endpoint and cause, and sends the call without a token, which a kernel with authentication turned off accepts.

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

Instead, the client sends its contract descriptor to the kernel on every new connection, and the kernel reports whether it can serve it. When the kernel reports an incompatibility, or does not implement the check, the client throws `IncompatibleChronicleServer`, does not retry, and rejects every later call. Deploy a compatible kernel and create a new client. Unlike the .NET client, the TypeScript client has no option to skip this check.

There is no published compatibility matrix. The examples in these guides were run against the `cratis/chronicle:19.4.8-development` image. Before you upgrade in production, test the client against the kernel version you run. [Preserve existing append routes](./migrate-append-routing.md) describes the upgrade that needs a kernel supporting kernel-owned append routing.

## Shut down

Create one `ChronicleClient` per process and share it. On shutdown, call `client.dispose()`. It stops the health checks and the keep-alive, ends reactor and reducer observations, and closes the channel. A disposed client rejects every later call with `ChronicleClient is disposed`, including a `getEventStore(...)` that is still waiting to connect.

Once it has disposed every client, the process can exit; the client leaves no open connections or timers behind.
