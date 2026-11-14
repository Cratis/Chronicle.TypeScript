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

## Read a graph with views

A view is a read model over a graph, anchored at one node label. Declare it with decorators next to the nodes and edges it reads, and name the graph with `@graph`. Views only read: a view is never a node or an edge, and it does not change how the graph is projected.

```typescript
@graph('Organization')
@viewOf(() => Group)
export class GroupSummary {
    @viewKey() id = '';
    @viewProperty() name = '';
}

@graph('Organization')
@viewOf(() => Group)
export class GroupMembership {
    @viewKey() id = '';
    @viewProperty() name = '';
    @fromEdge() since = new Date();
}

@graph('Organization')
@viewOf(() => Person)
export class PersonWithGroups {
    @viewKey() id = '';
    @viewProperty() name = '';
    @follows(() => MemberOf, () => GroupMembership) groups: GroupMembership[] = [];
}
```

Every member of a view carries one of these decorators, and members are read in the order they are declared. A field without one is not a member.

- `@viewOf(() => Node, { name })` anchors the view at a node. The classes are given as functions, so they can be declared in any order. The name of the view defaults to the name of the class and is unique in a graph.
- `@viewKey()` reads the key of the node, whatever the node calls it. `@viewProperty(source?)` reads another property of the node, matched without regard to case by the name of the member, or by `source`.
- `@follows(edge, view, options)` follows an edge to a nested view. `edge` is the edge class as a function, or the edge type string such as `'MEMBER_OF'`. `view` is the nested view class as a function. The direction is derived from the labels of the edge. An edge that starts and ends at the same label needs `{ direction: GraphEdgeDirection.Outgoing }` or `Incoming`.
- TypeScript erases the element type of a list, so the cardinality is declared. A relation yields a list by default, and `{ cardinality: GraphViewCardinality.One }` yields a single item, which is null when nothing is related.
- `@fromEdge(source?)` reads a property of the edge that was followed. It is valid only in a view that is the target of relations of exactly one edge type.

Views are found like every other artifact, and validated when the client discovers its graphs. The definition of the views of each graph is in `eventStore.graphs.viewDefinitions`. The definitions are the shared form every Cratis client emits for the same views, and `GraphViewDefinitionSerializer` writes them as canonical JSON:

```typescript
const definition = eventStore.graphs.viewDefinitions?.find(candidate => candidate.graph === 'Organization');
const json = new GraphViewDefinitionSerializer().serialize(definition!);
```

A view that breaks a rule is reported in `eventStore.graphs.failures` with an error that carries its `reason`, and the other graphs are still registered. The definition of a graph with an invalid view is withheld as a whole, because a view is read together with the views it nests. Graphs and models that do not use views behave exactly as before.

| Reason | Raised when |
| --- | --- |
| `ViewRootNotANode` | the view is anchored at a type that is not a node of its graph |
| `ViewIsAlsoSchema` | the view class is also a node or an edge |
| `DuplicateViewName` | two views of a graph have the same name |
| `UnknownNodeProperty` | a property member names a property the node does not declare |
| `UnknownEdge` | a relation follows an edge the graph does not declare |
| `UnknownEdgeProperty` | an edge property member names a property the edge does not declare |
| `EdgeNotIncidentOnRoot` | the edge does not start or end at the root of the view, or the stated direction is not one it can be followed in |
| `AmbiguousDirection` | a self edge is followed without a direction |
| `TargetLabelMismatch` | the nested view is not anchored at the label at the far end of the edge |
| `RelationTargetNotAView` | a relation yields a class that is not a view of the graph |
| `RecursiveView` | a view contains itself, directly or through other views |
| `EdgePropertyViewNotUsedAsTarget` | a view reads edge properties and no relation yields it |
| `EdgePropertyViewSharedAcrossEdges` | a view reads edge properties and relations of more than one edge type yield it |

The TypeScript client declares, validates and describes views. It does not execute reads yet: reading a view needs a host stack that is not provided for TypeScript, so the definitions are not registered with the kernel and nothing queries the graph for you.

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
- Reading the graph, including reading a view. Applications read it with the engine driver, as the shared page describes; the client only declares, validates and describes views.
- A test harness. `GraphScenario` is not available, so test a graph by asserting the definition it registers, for example from `eventStore.graphs.registrations`.
- Numbers in the graph schema are written as `number`, as in every other schema of this client. The .NET client writes the format of its CLR type, such as `integer` with `int32`.
