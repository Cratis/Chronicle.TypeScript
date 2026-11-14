// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { GraphViewMemberKind } from './GraphViewMemberKind.js';
import type { GraphView } from './GraphView.js';
import type { GraphViewDefinition } from './GraphViewDefinition.js';
import type { GraphViewMember } from './GraphViewMember.js';
import type { GraphViewSchema } from './GraphViewSchema.js';
import type { GraphViewSerializerOptions } from './GraphViewSerializerOptions.js';

/**
 * Serializes a {@link GraphViewDefinition} canonically. The text is the same for every client that declares the same
 * views: LF line endings, two-space indentation, a fixed order of properties, the views sorted by name in ordinal
 * order, the members in declaration order and one trailing newline.
 */
export class GraphViewDefinitionSerializer {
    /**
     * Serializes a definition.
     * @param definition - The {@link GraphViewDefinition}.
     * @param options - Whether to include the schema, which is the form of the conformance fixture.
     * @returns The canonical text.
     */
    serialize(definition: GraphViewDefinition, options: GraphViewSerializerOptions = {}): string {
        const views = [...definition.views].sort((left, right) => this.compareOrdinal(left.name, right.name));
        const lines = ['{', `  "graph": ${JSON.stringify(definition.graph)},`];
        if (options.includeSchema === true && definition.schema !== undefined) lines.push(...this.schema(definition.schema));
        if (views.length === 0) {
            lines.push('  "views": []');
        } else {
            lines.push('  "views": [');
            views.forEach((view, index) => lines.push(...this.view(view, index < views.length - 1)));
            lines.push('  ]');
        }

        lines.push('}');
        return `${lines.join('\n')}\n`;
    }

    private schema(schema: GraphViewSchema): string[] {
        const list = (names: readonly string[]) => (names.length === 0 ? '[]' : `[ ${names.map(name => JSON.stringify(name)).join(', ')} ]`);
        const nodes = schema.nodes.map(node =>
            `{ "label": ${JSON.stringify(node.label)}, "key": ${JSON.stringify(node.key)}, "properties": ${list(node.properties)} }`);
        const edges = schema.edges.map(edge => {
            const identity = edge.identifiedBy === undefined ? '' : ` "identifiedBy": ${JSON.stringify(edge.identifiedBy)},`;
            return `{ "type": ${JSON.stringify(edge.type)}, "source": ${JSON.stringify(edge.source)}, "target": ${JSON.stringify(edge.target)},${identity} "properties": ${list(edge.properties)} }`;
        });
        const block = (name: string, entries: string[], last: boolean) => [
            entries.length === 0 ? `    "${name}": []${last ? '' : ','}` : `    "${name}": [`,
            ...(entries.length === 0 ? [] : [
                ...entries.map((entry, index) => `      ${entry}${index < entries.length - 1 ? ',' : ''}`),
                `    ]${last ? '' : ','}`
            ])
        ];
        return ['  "schema": {', ...block('nodes', nodes, false), ...block('edges', edges, true), '  },'];
    }

    private view(view: GraphView, hasNext: boolean): string[] {
        const lines = ['    {', `      "name": ${JSON.stringify(view.name)},`, `      "root": ${JSON.stringify(view.root)},`];
        if (view.members.length === 0) {
            lines.push('      "members": []');
        } else {
            lines.push('      "members": [');
            view.members.forEach((member, index) => lines.push(`        ${this.member(member)}${index < view.members.length - 1 ? ',' : ''}`));
            lines.push('      ]');
        }

        lines.push(hasNext ? '    },' : '    }');
        return lines;
    }

    private member(member: GraphViewMember): string {
        const parts = [`"name": ${JSON.stringify(member.name)}`, `"kind": ${JSON.stringify(member.kind)}`];
        if (member.kind === GraphViewMemberKind.Relation) {
            parts.push(
                `"edge": ${JSON.stringify(member.edge)}`,
                `"direction": ${JSON.stringify(member.direction)}`,
                `"cardinality": ${JSON.stringify(member.cardinality)}`,
                `"view": ${JSON.stringify(member.view)}`);
        } else {
            parts.push(`"source": ${JSON.stringify(member.source)}`);
        }

        return `{ ${parts.join(', ')} }`;
    }

    private compareOrdinal(left: string, right: string): number {
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }
}
