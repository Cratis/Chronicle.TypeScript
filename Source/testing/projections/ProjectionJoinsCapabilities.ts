// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionArithmetic } from './ProjectionArithmetic.js';
import type { ProjectionJoinRecord } from './ProjectionJoinRecord.js';
import type { ProjectionJoinValidationContext } from './ProjectionJoinValidationContext.js';
import { ProjectionJoins } from './ProjectionJoins.js';

/** The string-only, single root join proven by the joins-* packaged-kernel fixtures. */
export class ProjectionJoinsCapabilities {
    /** Rejects unproven join shapes before any history is replayed. */
    static validate(definition: ProjectionDefinition, context: ProjectionJoinValidationContext): void {
        const joins = definition.Join as ProjectionJoinRecord[] ?? [];
        if (!joins.length) return;
        const { schema, reject, requireEventSchema, checkMapping } = context;
        const join = joins[0];
        const path = eventContractPath('Join', join.Key);
        if (joins.length !== 1) reject(path, 'multiple join subscriptions require a kernel-backed test');
        if (Object.keys(definition.Children ?? {}).length) reject(path, 'root joins combined with children require a kernel-backed test');
        const from = definition.From as FromRecord[] ?? [];
        if ([...from, ...joins].some(entry => Object.values(entry.Value.Properties ?? {}).some(ProjectionArithmetic.isArithmetic))) {
            reject(path, 'joins combined with arithmetic require a kernel-backed test');
        }
        if (Object.keys(JSON.parse(definition.InitialModelState || '{}') as object).length) {
            reject('InitialModelState', 'joins with initial model state require a kernel-backed test');
        }
        if (join.Value.Key !== '$eventSourceId') reject(`${path}.Key`, 'join keys other than $eventSourceId require a kernel-backed test; the kernel ignores custom root join keys');
        if (!join.Value.On || join.Value.On === 'id' || !/^[A-Za-z_]\w*$/.test(join.Value.On) || !schema.properties?.[join.Value.On]) {
            reject(`${path}.On`, 'joins require a direct non-identifier read-model property; other join targets require a kernel-backed test');
        }
        for (const [property, member] of Object.entries(schema.properties ?? {})) {
            if (!this.plainString(member)) reject(`ReadModel.Schema.${property}`, 'joins currently require plain string read-model properties; other schemas require a kernel-backed test');
        }
        if ([...from, ...(definition.RemovedWith as RemovedWithRecord[] ?? [])].some(entry => entry.Key.Id === join.Key.Id)) {
            reject(path, 'events shared between Join and From or RemovedWith require a kernel-backed test');
        }
        const joinSchema = requireEventSchema(join.Key, path);
        context.checkProtection(joinSchema, `${path}.EventSchema`);
        if (![AutoMap.Inherit, AutoMap.Enabled, AutoMap.Disabled].includes(join.Value.AutoMap ?? AutoMap.Inherit)) {
            reject(`${path}.AutoMap`, 'unknown join AutoMap settings require a kernel-backed test');
        }
        for (const [index, name] of Object.keys(joinSchema.properties ?? {}).entries()) {
            if (Object.keys(joinSchema.properties ?? {}).slice(index + 1).some(other => other.toLowerCase() === name.toLowerCase())) {
                reject(path, 'case-insensitively colliding join event properties require a kernel-backed test');
            }
        }
        const mappings = ProjectionJoins.properties(definition, joinSchema, schema);
        if (!Object.keys(mappings).length) reject(path, 'joins without effective property mappings require a kernel-backed test');
        for (const [property, expression] of Object.entries(mappings)) {
            const mappingPath = `${path}.${Object.hasOwn(join.Value.Properties ?? {}, property) ? 'Properties' : 'AutoMap'}.${property}`;
            if (property === join.Value.On) reject(mappingPath, 'a join cannot map its own join target in scenarios; this requires a kernel-backed test');
            this.checkStringMapping(joinSchema, expression, mappingPath, context);
            checkMapping(schema, joinSchema, property, expression, mappingPath);
        }
        let hasJoinTarget = false;
        for (const entry of from) {
            const fromPath = eventContractPath('From', entry.Key);
            const eventSchema = requireEventSchema(entry.Key, fromPath);
            const properties = { ...entry.Value.Properties };
            if (definition.AutoMap !== AutoMap.Disabled) {
                for (const source of Object.keys(eventSchema.properties ?? {})) {
                    const destination = Object.keys(schema.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
                    if (destination && !Object.keys(properties).some(name => name.toLowerCase() === destination.toLowerCase()) &&
                        !(definition.NoAutoMapProperties ?? []).some(name => name.toLowerCase() === destination.toLowerCase())) properties[destination] = source;
                }
            }
            hasJoinTarget ||= Object.hasOwn(properties, join.Value.On);
            for (const [property, expression] of Object.entries(properties)) {
                const mappingPath = `${fromPath}.${Object.hasOwn(entry.Value.Properties ?? {}, property) ? 'Properties' : 'AutoMap'}.${property}`;
                if (Object.hasOwn(mappings, property)) reject(mappingPath, 'From and Join mapping the same property requires a kernel-backed test');
                this.checkStringMapping(eventSchema, expression, mappingPath, context);
            }
        }
        if (!hasJoinTarget) reject(`${path}.On`, 'joins require a From mapping for the join target; join-only projections require a kernel-backed test');
    }

    private static checkStringMapping(eventSchema: JsonSchema, expression: string, path: string, context: ProjectionJoinValidationContext): void {
        if (!/^[A-Za-z_]\w*$/.test(expression) || !this.plainString(eventSchema.properties?.[expression])) {
            context.reject(path, 'joins support direct plain string event-property mappings only; context, constants and other expressions require a kernel-backed test');
        }
    }

    private static plainString(schema: JsonSchema | undefined): boolean {
        return schema?.type === 'string' && !schema.format;
    }
}
