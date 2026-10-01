---
title: PII
description: Release PII in raw stored read model documents with the TypeScript client.
sharedTopicBridge: true
---

PII classification and release behavior are shared Chronicle compliance topics.

- [PII](/chronicle/compliance/pii/)
- [Compliance](/chronicle/compliance/)
- [TypeScript client setup](../getting-started.md)

## Release a stored document

If you read a read model directly from its store, use
`readModels.releaseDocument(ReadModelType, document)` to release its PII. Supply
the discovered read model class with its runtime field types and PII metadata,
and the raw JSON document with its stored `__subject` and `__subjects` fields.
Do not convert the document to a class instance first: that can discard the
subject metadata needed for joined data.

For example, given your configured `store`, discovered `AccountSummary` read
model, and a raw stored `document`:

```typescript
const released = await store.readModels.releaseDocument(AccountSummary, document);
```

The result is a new plain `Record<string, unknown>`, not an `AccountSummary`
instance. Only schema-declared top-level properties are returned; storage-only
fields, including `__subject` and `__subjects`, are removed. The input document
and its nested values are not mutated.

Subject selection follows the stored metadata:

- `__subjects` maps **top-level property names** to non-empty subject strings.
  Each mapping applies to the property's entire subtree, including arrays.
  Null or empty mapping values are ignored, so those properties use the default
  subject. A non-object `__subjects` value is treated as an empty map.
  Dotted paths such as `contact.phone` are not supported.
- `__subject` is a non-empty string used for properties without a mapping.
  Null or an empty string means there is no default subject. Whitespace-only
  subject strings are valid and passed through unchanged.
- Properties with neither subject are copied unchanged, without release. There
  is no fallback to `id` or `@subject()`.

The client makes one release call per distinct subject, using only that
subject's properties and their schemas. If a call reports `HasError`, fails in
transport, or returns malformed, missing, or conflicting properties, the whole
operation rejects. Non-string subjects other than null, reserved subject-map
names, and mappings for document properties absent from the schema also reject.
Mappings for properties absent from the document are ignored after validating
their subject values. You never receive a partially merged document. Errors omit
kernel and transport details because they can contain PII.

Chronicle 19.26.2 can replace individual values with empty values after a
per-property decryption failure while still returning `HasError: false`.
The client cannot detect these unreported failures and does not guess from an
empty value. Track this limitation in
[Chronicle issue 4480](https://github.com/Cratis/Chronicle/issues/4480).

For a typed instance with one subject, keep using `readModels.release(type,
instance)` or `releaseMany(type, instances)`; those APIs are unchanged.
