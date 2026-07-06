```text
TypeScript does not support this workflow yet.
`AppendOptions` only carries `correlationId`, `eventSourceId`, and `concurrencyScope` —
there is no way to attach tags or a custom event stream type when appending from
TypeScript. Track the client SDK issue before relying on metadata-filtered
observers from TypeScript.
```
