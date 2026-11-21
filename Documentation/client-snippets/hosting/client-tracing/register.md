This is .NET hosting: it registers the Chronicle client's activity source with the .NET OpenTelemetry SDK.
The TypeScript client has no hosting builder. It reports spans through `@opentelemetry/api`, so register your
OpenTelemetry Node SDK in the application as usual; see [Observability](../../../observability.md).

```text
TypeScript does not support this workflow yet.
```
