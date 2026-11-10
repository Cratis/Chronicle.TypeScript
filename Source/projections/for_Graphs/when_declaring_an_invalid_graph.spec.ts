// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { fromEvent } from '../modelBound/fromEvent.js';
import { edge } from '../graphs/edge.js';
import { edgeFrom } from '../graphs/edgeFrom.js';
import { edgeSource } from '../graphs/edgeSource.js';
import { edgeTarget } from '../graphs/edgeTarget.js';
import { EdgeCanHaveOnlyOneIdentifyingKey } from '../graphs/EdgeCanHaveOnlyOneIdentifyingKey.js';
import { EdgeMustHaveOneSourceAndOneTarget } from '../graphs/EdgeMustHaveOneSourceAndOneTarget.js';
import { graph } from '../graphs/graph.js';
import { GraphDeclaredMoreThanOnce } from '../graphs/GraphDeclaredMoreThanOnce.js';
import { GraphElementCannotBeReadModel } from '../graphs/GraphElementCannotBeReadModel.js';
import { GraphHasDuplicateElement } from '../graphs/GraphHasDuplicateElement.js';
import { graphKey } from '../graphs/graphKey.js';
import { GraphKeyPropertyNotFound } from '../graphs/GraphKeyPropertyNotFound.js';
import { GraphNameRequired } from '../graphs/GraphNameRequired.js';
import { graphProjection } from '../graphs/graphProjection.js';
import type { IGraphProjection } from '../graphs/IGraphProjection.js';
import type { IGraphProjectionBuilder } from '../graphs/IGraphProjectionBuilder.js';
import { NestedObjectInGraph } from '../graphs/NestedObjectInGraph.js';
import { SetOnceNotSupportedInGraph } from '../graphs/SetOnceNotSupportedInGraph.js';
import { setFrom } from '../modelBound/setFrom.js';
import { setFromContext } from '../modelBound/setFromContext.js';
import { node } from '../graphs/node.js';
import { nodeFrom } from '../graphs/nodeFrom.js';
import { NodeMustHaveExactlyOneKey } from '../graphs/NodeMustHaveExactlyOneKey.js';
import { UnknownGraphNode } from '../graphs/UnknownGraphNode.js';
import { discoverGraphs } from './given/a_discovered_graph.js';

chai.should();

class ThingHappened { thingId = ''; }
eventType()(ThingHappened);

function aNode(graphName: string, ...keys: string[]) {
    class Thing {
        thingId = '';
        otherId = '';
    }
    graph(graphName)(Thing);
    node()(Thing);
    for (const key of keys) graphKey()(Thing.prototype, key);
    nodeFrom(ThingHappened, { key: 'thingId' })(Thing);
    return Thing;
}

async function failureOf(...elements: Function[]) {
    const result = await discoverGraphs(elements as never[]);
    const failures = [...result.graphs.failures.values()];
    return { failures, registered: result.graphs.registrations.length };
}

describe('when a node has no key', () => {
    it('should fail with NodeMustHaveExactlyOneKey', async () => {
        const { failures, registered } = await failureOf(aNode('NoKey'));
        failures[0].should.be.instanceOf(NodeMustHaveExactlyOneKey);
        registered.should.equal(0);
    });
});

describe('when a node has two keys', () => {
    it('should fail with NodeMustHaveExactlyOneKey', async () => {
        const { failures } = await failureOf(aNode('TwoKeys', 'thingId', 'otherId'));
        failures[0].should.be.instanceOf(NodeMustHaveExactlyOneKey).and.have.property('message').that.includes('but it has 2');
    });
});

describe('when the key of a node is not a property', () => {
    it('should fail with GraphKeyPropertyNotFound', async () => {
        class Keyless { present = ''; }
        graph('Keyless')(Keyless);
        node()(Keyless);
        graphKey()(Keyless.prototype, 'absent');
        const { failures } = await failureOf(Keyless);
        failures[0].should.be.instanceOf(GraphKeyPropertyNotFound);
    });
});

describe('when an edge does not name its end nodes', () => {
    it('should fail with EdgeMustHaveOneSourceAndOneTarget', async () => {
        class Dangling { weight = 0; }
        graph('Dangling')(Dangling);
        edge('DANGLES')(Dangling);
        const { failures } = await failureOf(Dangling);
        failures[0].should.be.instanceOf(EdgeMustHaveOneSourceAndOneTarget);
    });
});

describe('when an edge has two identifying keys', () => {
    it('should fail with EdgeCanHaveOnlyOneIdentifyingKey', async () => {
        const Thing = aNode('TwoIdentities', 'thingId');
        class Twice { fromId = ''; toId = ''; a = ''; b = ''; }
        graph('TwoIdentities')(Twice);
        edge('TWICE')(Twice);
        edgeSource(Thing)(Twice.prototype, 'fromId');
        edgeTarget(Thing)(Twice.prototype, 'toId');
        graphKey()(Twice.prototype, 'a');
        graphKey()(Twice.prototype, 'b');
        edgeFrom(ThingHappened, { sourceKey: 'thingId', targetKey: 'thingId' })(Twice);
        const { failures } = await failureOf(Thing, Twice);
        failures[0].should.be.instanceOf(EdgeCanHaveOnlyOneIdentifyingKey);
    });
});

describe('when an edge connects a type that is not a node of its graph', () => {
    it('should fail with UnknownGraphNode', async () => {
        const Thing = aNode('Unconnected', 'thingId');
        class Stranger { strangerId = ''; }
        class Lonely { fromId = ''; toId = ''; }
        graph('Unconnected')(Lonely);
        edge('LONELY')(Lonely);
        edgeSource(Thing)(Lonely.prototype, 'fromId');
        edgeTarget(Stranger)(Lonely.prototype, 'toId');
        const { failures, registered } = await failureOf(Thing, Lonely);
        failures[0].should.be.instanceOf(UnknownGraphNode);
        registered.should.equal(0);
    });
});

describe('when a node has an object property', () => {
    it('should fail with NestedObjectInGraph', async () => {
        class Address { street = ''; }
        class Resident { residentId = ''; address = new Address(); }
        field(String)(Resident.prototype, 'residentId');
        field(Address)(Resident.prototype, 'address');
        graph('Residents')(Resident);
        node()(Resident);
        graphKey()(Resident.prototype, 'residentId');
        const { failures } = await failureOf(Resident);
        failures[0].should.be.instanceOf(NestedObjectInGraph).and.have.property('message').that.includes("'address'");
    });
});

describe('when a node property is set from an event only once', () => {
    it('should fail with SetOnceNotSupportedInGraph', async () => {
        const Thing = aNode('SetOnceNode', 'thingId');
        setFrom(ThingHappened, { eventPropertyName: 'thingId', setOnce: true })(Thing.prototype, 'otherId');
        const { failures, registered } = await failureOf(Thing);
        failures[0].should.be.instanceOf(SetOnceNotSupportedInGraph).and.have.property('message').that.includes("'otherId'");
        registered.should.equal(0);
    });
});

describe('when an edge property is set from the event context only once', () => {
    it('should fail with SetOnceNotSupportedInGraph', async () => {
        const Thing = aNode('SetOnceEdge', 'thingId');
        class Linked { fromId = ''; toId = ''; since = new Date(); }
        graph('SetOnceEdge')(Linked);
        edge('LINKED')(Linked);
        edgeSource(Thing)(Linked.prototype, 'fromId');
        edgeTarget(Thing)(Linked.prototype, 'toId');
        setFromContext(ThingHappened, { contextProperty: 'occurred', setOnce: true })(Linked.prototype, 'since');
        edgeFrom(ThingHappened, { sourceKey: 'thingId', targetKey: 'thingId' })(Linked);
        const { failures } = await failureOf(Thing, Linked);
        failures[0].should.be.instanceOf(SetOnceNotSupportedInGraph).and.have.property('message').that.includes("'since'");
    });
});

describe('when a node does not say which graph it belongs to', () => {
    it('should fail with GraphNameRequired', async () => {
        class Homeless { homelessId = ''; }
        node()(Homeless);
        graphKey()(Homeless.prototype, 'homelessId');
        const { failures } = await failureOf(Homeless);
        failures[0].should.be.instanceOf(GraphNameRequired);
    });
});

describe('when a node is also a read model', () => {
    it('should fail with GraphElementCannotBeReadModel', async () => {
        const Thing = aNode('Both', 'thingId');
        fromEvent(ThingHappened)(Thing);
        const { failures } = await failureOf(Thing);
        failures[0].should.be.instanceOf(GraphElementCannotBeReadModel);
    });
});

describe('when two nodes of a graph have the same label', () => {
    it('should fail with GraphHasDuplicateElement', async () => {
        const first = aNode('Duplicates', 'thingId');
        const second = aNode('Duplicates', 'thingId');
        const { failures } = await failureOf(first, second);
        failures[0].should.be.instanceOf(GraphHasDuplicateElement);
    });
});

describe('when one graph is invalid', () => {
    it('should still register the valid graphs', async () => {
        const valid = aNode('Valid', 'thingId');
        const invalid = aNode('Invalid');
        const result = await discoverGraphs([valid, invalid]);
        result.graphs.registrations.map(_ => _.graphName).should.deep.equal(['Valid']);
        result.graphs.failures.has(invalid).should.be.true;
    });

    it('should leave a graph unregistered when one of its elements is invalid', async () => {
        const valid = aNode('Partial', 'thingId');
        class Unfinished { unfinishedId = ''; }
        graph('Partial')(Unfinished);
        node()(Unfinished);
        const result = await discoverGraphs([valid, Unfinished]);
        result.graphs.registrations.length.should.equal(0);
        result.graphs.failures.has(Unfinished).should.be.true;
    });
});

describe('when two graph projections declare the same graph', () => {
    it('should register the first and fail the second with GraphDeclaredMoreThanOnce', async () => {
        const Thing = aNode('Twice', 'thingId');
        class First implements IGraphProjection {
            define(builder: IGraphProjectionBuilder): void {
                builder.node(Thing, node => node.from(ThingHappened));
            }
        }
        class Second extends First {}
        graphProjection('Twice')(First);
        graphProjection('Twice')(Second);
        const result = await discoverGraphs([], [First, Second]);
        result.graphs.registrations.length.should.equal(1);
        result.graphs.failures.get(Second)!.should.be.instanceOf(GraphDeclaredMoreThanOnce);
    });
});
