---
title: Graph projections
description: Project events onto a property graph with the TypeScript client's node and edge decorators or fluent builder, and register the graph with Chronicle.
---

See [Graph projections](/chronicle/projections/graph-projections/) for what a graph projection is: how nodes, edges and their properties are projected, the five idempotent operations a graph sink applies, redelivery and replay, and the sinks. This page covers the TypeScript client: the decorators and the fluent builder, what the client checks, and how a graph is registered.

Projections run in the Chronicle Kernel. The client only builds the graph definition and registers it, so the same graph declared with the .NET, Elixir or TypeScript client registers the same definition. The graph is what the events leave behind. Nothing writes to it directly.

## Nodes and edges

A node is a class decorated with `@node()`. Its fields are the properties of the node, and the field with `@graphKey()` holds its unique key. A property is a primitive or an array of primitives; an object property is an error, so model the object as a node of its own and connect it with an edge. The label of a node is the name of the class. `@node('Employee')` chooses another one.

An edge is a class decorated with `@edge('MEMBER_OF')`. `@edgeSource(NodeClass)` and `@edgeTarget(NodeClass)` mark the fields that hold the keys of the nodes at both ends. Those fields are not properties of the edge.

Name the graph with `@graph('Organization')` on every node and edge. All the nodes and edges that name the same graph are registered as one graph, and the name is the name of the read model the graph is registered as. A node or edge without `@graph` is an error, because TypeScript has no assembly to name the graph after.

Give every field a type the client can resolve: an initializer, or `@field(Type)` from `@cratis/fundamentals`. The client writes the schema of the graph from them, the same way it writes the schema of a read model.

## Model-bound

Declare which events create, update and remove nodes and edges with decorators on the classes.

```typescript
@graph('Organization')
@node()
@nodeFrom(PersonRegistered, { key: 'personId' })
@nodeRemovedWith(PersonRemoved, { key: 'personId', detach: true })
export class Person {
    @graphKey() personId = '';
    name = '';
}

@graph('Organization')
@node()
@nodeFrom(GroupCreated, { key: 'groupId' })
export class Group {
    @graphKey() groupId = '';
    name = '';
}

@graph('Organization')
@edge('MEMBER_OF')
@edgeFrom(MemberAdded, { sourceKey: 'personId', targetKey: 'groupId' })
@edgeRemovedWith(MemberRemoved, { sourceKey: 'personId', targetKey: 'groupId' })
export class MemberOf {
    @edgeSource(Person) personId = '';
    @edgeTarget(Group) groupId = '';
    @setFromContext(MemberAdded, 'occurred') since = new Date();
}
```

- `@nodeFrom(Event, options)` creates or updates the node when the event occurs. `key` names the event property that holds the key of the node and defaults to the event source id. `constantKey` makes every event update the same node. `updateOnly: true` changes the node only when it already exists.
- `@nodeRemovedWith(Event, options)` deletes the node. A node that still has edges cannot be deleted unless `detach: true` deletes those edges with it.
- `@edgeFrom(Event, { sourceKey, targetKey, identity })` creates or updates the edge. Both end nodes are created without properties when they do not exist.
- `@edgeRemovedWith(Event, { sourceKey, targetKey, identity })` deletes the edge. The nodes at both ends stay.

A property is mapped by name from an event that has a property of the same name, or explicitly with the property decorators you already know from [read model projections](./projections.md): `@setFrom`, `@setFromContext`, `@setValue`, `@addFrom`, `@subtractFrom`, `@increment`, `@decrement` and `@count`. To clear a property, use `@setValue(Event, null)`.

A node or an edge is never a read model. The client does not register one for a class that has `@node()` or `@edge()`, and a class that also has `@fromEvent` is an error.

## Fluent

The same graph can be declared with a fluent builder. It produces exactly the same definition as the decorators.

```typescript
@graphProjection('Organization')
export class OrganizationGraph implements IGraphProjection {
    define(builder: IGraphProjectionBuilder): void {
        builder
            .node(Person, node => node
                .from(PersonRegistered, from => from.usingKey(event => event.personId))
                .removedWith(PersonRemoved, removed => removed
                    .usingKey(event => event.personId)
                    .detach()))
            .node(Group, node => node
                .from(GroupCreated, from => from.usingKey(event => event.groupId)))
            .edge(MemberOf, Person, Group, edge => edge
                .from(MemberAdded, from => from
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)
                    .set(memberOf => memberOf.since).toEventContextProperty('occurred'))
                .removedWith(MemberRemoved, removed => removed
                    .usingSourceKey(event => event.personId)
                    .usingTargetKey(event => event.groupId)));
    }
}
```

`@graphProjection('Organization')` marks the class for discovery and names the graph; without a name it is the name of the class. The fluent builder differs from the decorators in these ways:

- The node, edge and end node classes are arguments, so the classes need no `@node`, `@edge`, `@edgeSource` or `@edgeTarget`. Without `@node`, the label is the name of the class. `.named('MEMBER_OF')` names the edge type.
- `.identifiedBy(node => node.personId)` declares the key of a node, or the identity of an edge, when the field has no `@graphKey()`.
- A node or edge field is mapped with `.set(...)` and `.to(...)`, `.toEventContextProperty(...)`, `.toValue(...)` or `.toEventSourceId()`, and with `.add(...).with(...)`, `.subtract(...).with(...)`, `.increment(...)`, `.decrement(...)` and `.count(...)`.
- `.onlyWhenExisting()` on a node's `from` changes the node only when it already exists.

## Counters

Counters work on node and edge properties.

```typescript
@graph('Teams')
@node()
@nodeFrom(TeamFormed, { key: 'teamId' })
@nodeFrom(TeamMemberJoined, { key: 'teamId' })
@nodeFrom(TeamMemberLeft, { key: 'teamId' })
export class Team {
    @graphKey() teamId = '';
    name = '';
    @increment(TeamMemberJoined) @decrement(TeamMemberLeft) memberCount = 0;
}
```

## Edges with an identity

By default an edge is identified by its type, source and target. Give a field of the edge `@graphKey()` to identify it among several edges of the same type between the same two nodes. Every `@edgeFrom` and `@edgeRemovedWith` of the edge then has to say which event property holds the identity: `identity` names it, and without it the event property named like the field is used. A sink that cannot hold several edges between the same pair of nodes rejects such an edge type.

```typescript
@graph('Places')
@edge('VISITED')
@edgeFrom(PlaceVisited, { sourceKey: 'personId', targetKey: 'placeId', identity: 'visitId' })
export class Visited {
    @edgeSource(Visitor) personId = '';
    @edgeTarget(Place) placeId = '';
    @graphKey() visitId = '';
    @count(PlaceVisited) times = 0;
}
```

## What the client checks

A graph that cannot work is not registered. The client reports the error, with the node or edge it concerns, in `eventStore.graphs.failures` and in its log, and registers the other graphs. A graph with a failing node or edge is left out as a whole, because a replay would otherwise sweep away what the missing node or edge left behind. The errors are exported from `@cratis/chronicle`:

| Error | Raised when |
| --- | --- |
| `NodeMustHaveExactlyOneKey` | a node does not have exactly one field with `@graphKey()` |
| `EdgeMustHaveOneSourceAndOneTarget` | a decorated edge does not have exactly one `@edgeSource` and one `@edgeTarget` field |
| `EdgeCanHaveOnlyOneIdentifyingKey` | an edge has more than one field with `@graphKey()` |
| `NestedObjectInGraph` | a node or edge has an object property |
| `UnknownGraphEventProperty` | an event of an identified edge has no property to read the identity from, and none is named |
| `UnknownGraphNode` | an edge connects a class that is not a node of its graph |
| `GraphKeyPropertyNotFound` | the key or identity is not a property of the class |
| `GraphNameRequired` | a decorated node or edge does not say which graph it belongs to |
| `GraphElementCannotBeReadModel` | a node or edge is also a read model |
| `GraphHasDuplicateElement` | a graph has two nodes with the same label or two edges of the same type |
| `GraphDeclaredMoreThanOnce` | two graph projections declare the same graph |

## Registering a graph

Nodes, edges and graph projections are found the same way as every other artifact, and registered together with them when the client connects. The graph is registered as a read model stored by the graph sink, and as the projection that fills it. The name of the graph is the name of the read model and, for decorated nodes and edges, the identifier of the projection; a fluent graph projection is identified by the name of its class. Keep the names stable, because renaming one makes Chronicle treat the graph as a different projection.

## Choosing the sink

A graph is stored by a graph sink. Set the sink type with `defaultGraphSinkTypeId`, which defaults to `WellKnownSinks.Neo4j`. Use `WellKnownSinks.InMemoryGraph` for development and tests.

```typescript
import { ChronicleClient, ChronicleOptions, WellKnownSinks } from '@cratis/chronicle';

const options = ChronicleOptions.fromConnectionString(
    'chronicle://localhost:35000',
    { defaultGraphSinkTypeId: WellKnownSinks.InMemoryGraph });

const client = new ChronicleClient(options);
```

`defaultSinkTypeId` keeps choosing the sink of document read models; it does not apply to graphs. See [Sinks](./sinks.md).

## What the TypeScript client does not do yet

- Naming a sink configuration for a graph. The client registers the sink type only, and the kernel uses its default configuration for it.
- Reading the graph. Applications read it with the engine driver, as the shared page describes.
- A test harness. `GraphScenario` is not available, so test a graph by asserting the definition it registers, for example from `eventStore.graphs.registrations`.
- Numbers in the graph schema are written as `number`, as in every other schema of this client. The .NET client writes the format of its CLR type, such as `integer` with `int32`.
