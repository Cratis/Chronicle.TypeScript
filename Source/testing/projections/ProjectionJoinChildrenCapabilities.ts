// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import type { ProjectionJoinRecord } from './ProjectionJoinRecord.js';
import type { RejectOperation } from './ProjectionChildrenCapabilities.js';

type Child = ChildrenDefinitionLike & { FromEventProperty?: unknown };

/** The measured intersection of one string root join and independent typed, parent-first children. */
export class ProjectionJoinChildrenCapabilities {
    static supports(definition: ProjectionDefinition, schema: JsonSchema): boolean {
        const collections = Object.entries(definition.Children ?? {}) as Array<[string, Child]>;
        if (collections.length !== 1 || definition.From.length !== 1) return false;
        const [collection, child] = collections[0];
        const join = (definition.Join as ProjectionJoinRecord[])[0];
        const targets = Object.keys(join.Value.Properties ?? {});
        if (targets.length !== 1) return false;
        return this.rootShape(definition, schema, new Set(['id', collection, join.Value.On, targets[0]]))
            && this.childShape(child, schema.properties?.[collection])
            && this.independentEvents(definition, child);
    }

    static validateHistory(definition: ProjectionDefinition, events: readonly ScenarioEvent[], reject: RejectOperation): void {
        if (!this.hasJoinChildren(definition)) return;
        const rootEvents = new Set((definition.From as FromRecord[]).map(entry => entry.Key.Id));
        const removed = new Set((definition.RemovedWith as RemovedWithRecord[]).map(entry => entry.Key.Id));
        const childEvents = this.childEventIds(Object.values(definition.Children)[0] as Child);
        const initialized = new Set<string>();
        for (const event of events) {
            const type = event.context.eventType.id.value;
            if (childEvents.has(type) && !initialized.has(event.sourceId)) {
                reject('Children', 'joins with children require a root From event before each child event; other histories require a kernel-backed test');
            }
            if (rootEvents.has(type)) initialized.add(event.sourceId);
            if (removed.has(type)) initialized.delete(event.sourceId);
        }
    }

    private static hasJoinChildren(definition: ProjectionDefinition): boolean {
        return definition.Join.length > 0 && Object.keys(definition.Children ?? {}).length > 0;
    }

    private static rootShape(definition: ProjectionDefinition, schema: JsonSchema, allowed: Set<string>): boolean {
        return this.exactRootMembers(schema, allowed) && this.rootMapping(definition)
            && definition.AutoMap === AutoMap.Enabled && !(definition.NoAutoMapProperties ?? []).length
            && definition.RemovedWith.length <= 1;
    }

    private static exactRootMembers(schema: JsonSchema, allowed: Set<string>): boolean {
        const members = Object.keys(schema.properties ?? {});
        return allowed.size === 4 && members.length === 4 && members.every(name => allowed.has(name));
    }

    private static rootMapping(definition: ProjectionDefinition): boolean {
        const from = (definition.From as FromRecord[])[0].Value;
        const on = (definition.Join as ProjectionJoinRecord[])[0].Value.On;
        return this.sourceKey(from) && Object.keys(from.Properties).length === 1 && Object.hasOwn(from.Properties, on);
    }

    private static sourceKey(from: FromRecord['Value']): boolean {
        return from.Key === '$eventSourceId' && !from.ParentKey;
    }

    private static childShape(child: Child, collection?: JsonSchema): boolean {
        return collection?.type === 'array' && this.stringItems(collection.items, child.IdentifiedBy)
            && child.From.length === 1 && child.Join.length === 0 && child.RemovedWith.length <= 1
            && this.childAutoMap(child) && this.directChildKey(child);
    }

    private static directChildKey(child: Child): boolean {
        if (child.FromEventProperty || Object.keys(child.Children ?? {}).length) return false;
        return [...child.From, ...child.RemovedWith].every(entry =>
            entry.Value?.Key === child.IdentifiedBy && ['', '$eventSourceId'].includes(entry.Value.ParentKey ?? ''))
            && child.From.every(entry => !Object.keys(entry.Value?.Properties ?? {}).length);
    }

    private static stringItems(items: JsonSchema | undefined, identifier: string): boolean {
        if (items?.type !== 'object' || !items.properties?.[identifier]) return false;
        return Object.keys(items.properties).length === 2
            && Object.values(items.properties).every(member => member.type === 'string' && !member.format);
    }

    private static childAutoMap(value: { AutoMap?: AutoMap; NoAutoMapProperties?: string[] }): boolean {
        return [AutoMap.Inherit, AutoMap.Enabled].includes(value.AutoMap ?? AutoMap.Inherit)
            && !(value.NoAutoMapProperties ?? []).length;
    }

    private static independentEvents(definition: ProjectionDefinition, child: ChildrenDefinitionLike): boolean {
        const roots = [...definition.From, ...definition.Join, ...definition.RemovedWith].map(entry => entry.Key?.Id);
        const children = [...child.From, ...child.RemovedWith].map(entry => entry.Key.Id);
        return new Set([...roots, ...children]).size === roots.length + children.length;
    }

    private static childEventIds(child: ChildrenDefinitionLike): Set<string> {
        return new Set([...child.From, ...child.RemovedWith].map(entry => entry.Key!.Id));
    }
}
