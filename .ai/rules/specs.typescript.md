---
applyTo: "**/for_*/**/*.ts, **/when_*/**/*.ts"
---

# How to Write TypeScript Specs

TypeScript specs follow a BDD philosophy — they describe behaviors, not implementations.

## Frameworks

- [Vitest](https://vitest.dev/) for running tests.
- [Chai](https://www.chaijs.com) for assertions — **always use the `.should` fluent interface**, never `expect()`.
- Run tests with `yarn test` from each package.

## File Structure

Tests live alongside source code in `for_`, `when_`, or `given_` folders:

```
for_ChronicleClient/
├── given/
│   └── a_chronicle_client.ts
├── when_getting_an_event_store/
│   ├── and_it_exists.ts
│   └── and_it_does_not_exist.ts
```

## BDD Pattern

```typescript
describe('when getting an event store', () => {
    let result: IEventStore;

    beforeEach(async () => {
        result = await context.client.getEventStore('MyStore');
    });

    it('should return an event store', () => {
        result.should.not.be.null;
    });
});
```

## Naming Conventions

- Use **spaces** (not underscores) in `it()` descriptions.
- Start `it()` descriptions with "should".
- `describe()` text describes the scenario in natural language.

## Assertions — Chai Fluent Interface

**Always use the `.should` fluent interface. Never use `expect()`.**

```typescript
value.should.equal(expected);
value.should.be.true;
value.should.not.be.null;
value.should.deep.equal(expected);
array.should.have.lengthOf(3);
```
