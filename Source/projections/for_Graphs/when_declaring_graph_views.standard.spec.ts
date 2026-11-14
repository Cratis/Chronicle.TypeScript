// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it, type Assertion } from 'vitest';
import { GraphViewDefinitionSerializer } from '../graphs/views/GraphViewDefinitionSerializer.js';
import { GraphViewMemberKind } from '../graphs/views/GraphViewMemberKind.js';
import { discoverGraphs } from './given/a_discovered_graph.js';
import { organizationElements, organizationViews } from './given/organization_with_views.fixture.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

const fixtureText = readFileSync(new URL('./given/graph-views-organization.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureText) as { graph: string; schema: unknown; views: unknown };

// The fixture carries the graph the views are declared over beside the definition. The definition is the graph name
// and the views, so what is compared byte for byte is the fixture without its schema section.
function withoutSchema(text: string): string {
    const lines = text.split('\n');
    const start = lines.indexOf('  "schema": {');
    const end = lines.indexOf('  },', start);
    lines.splice(start, end - start + 1);
    return lines.join('\n');
}

describe('when declaring the organization graph and its views with decorators', () => {
    it('should emit the schema-included form of the fixture, byte for byte', async () => {
        const result = await discoverGraphs(organizationElements, [], 'Neo4j', organizationViews);
        should(result.graphs.failures.size).equal(0);
        should(new GraphViewDefinitionSerializer().serialize(result.graphs.viewDefinitions[0], { includeSchema: true })).equal(fixtureText);
    });

    it('should emit the default form as the fixture without its schema section, byte for byte', async () => {
        const result = await discoverGraphs(organizationElements, [], 'Neo4j', organizationViews);
        should(result.graphs.failures.size).equal(0);
        should(result.graphs.viewDefinitions).have.lengthOf(1);
        should(new GraphViewDefinitionSerializer().serialize(result.graphs.viewDefinitions[0])).equal(withoutSchema(fixtureText));
    });

    it('should emit views and members the way the fixture says', async () => {
        const result = await discoverGraphs(organizationElements, [], 'Neo4j', organizationViews);
        const definition = result.graphs.viewDefinitions[0];
        should(definition.graph).equal(fixture.graph);
        should(definition.views.map(view => view.name)).deep.equal((fixture.views as Array<{ name: string }>).map(view => view.name));
        should(JSON.parse(new GraphViewDefinitionSerializer().serialize(definition)).views).deep.equal(fixture.views);
        should(definition.views.flatMap(view => view.members).some(member => member.kind === GraphViewMemberKind.Relation)).be.true;
    });
});
