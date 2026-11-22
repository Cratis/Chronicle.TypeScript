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
import { ProjectionJoinChildrenCapabilities } from './ProjectionJoinChildrenCapabilities.js';

/** The string-only, single root join proven by the joins-* packaged-kernel fixtures. */
export class ProjectionJoinsCapabilities {
    /** Rejects unproven join shapes before any history is replayed. */
    static validate(definition: ProjectionDefinition, context: ProjectionJoinValidationContext): void {
        const joins = definition.Join as ProjectionJoinRecord[] ?? [];
        if (!joins.length) return;
        const join = joins[0];
        const path = eventContractPath('Join', join.Key);
        this.checkInteractions(definition, joins, path, context);
        this.checkTarget(join, path, context);
        this.checkRootSchema(definition, context);
        this.checkEventIsolation(definition, join, path, context);
        const joinSchema = context.requireEventSchema(join.Key, path);
        context.checkProtection(joinSchema, `${path}.EventSchema`);
        this.checkAutoMap(join, path, context);
        this.checkCaseCollisions(joinSchema, path, context);
        const mappings = ProjectionJoins.properties(definition, joinSchema, context.schema);
        this.checkJoinMappings(join, joinSchema, mappings, path, context);
        this.checkFromMappings(definition, join, mappings, path, context);
    }

    private static checkInteractions(definition: ProjectionDefinition, joins: ProjectionJoinRecord[], path: string, context: ProjectionJoinValidationContext): void {
        const { reject } = context;
        if (joins.length !== 1) reject(path, 'multiple join subscriptions require a kernel-backed test');
        if (Object.keys(definition.Children ?? {}).length && !ProjectionJoinChildrenCapabilities.supports(definition, context.schema)) {
            reject(path, 'root joins combined with children require a kernel-backed test');
        }
        const from = definition.From as FromRecord[] ?? [];
        if ([...from, ...joins].some(entry => Object.values(entry.Value.Properties ?? {}).some(ProjectionArithmetic.isArithmetic))) {
            reject(path, 'joins combined with arithmetic require a kernel-backed test');
        }
        if (Object.keys(JSON.parse(definition.InitialModelState || '{}') as object).length) {
            reject('InitialModelState', 'joins with initial model state require a kernel-backed test');
        }
    }

    private static checkTarget(join: ProjectionJoinRecord, path: string, context: ProjectionJoinValidationContext): void {
        if (join.Value.Key !== '$eventSourceId') context.reject(`${path}.Key`, 'join keys other than $eventSourceId require a kernel-backed test; the kernel ignores custom root join keys');
        if (!this.validTarget(join.Value.On, context.schema)) {
            context.reject(`${path}.On`, 'joins require a direct non-identifier read-model property; other join targets require a kernel-backed test');
        }
    }

    private static validTarget(on: string, schema: JsonSchema): boolean {
        return !!on && on !== 'id' && /^[A-Za-z_]\w*$/.test(on) && !!schema.properties?.[on];
    }

    private static checkRootSchema(definition: ProjectionDefinition, context: ProjectionJoinValidationContext): void {
        for (const [property, member] of Object.entries(context.schema.properties ?? {})) {
            if (Object.hasOwn(definition.Children ?? {}, property)) continue;
            if (!this.plainString(member)) context.reject(`ReadModel.Schema.${property}`, 'joins currently require plain string read-model properties; other schemas require a kernel-backed test');
        }
    }

    private static checkEventIsolation(definition: ProjectionDefinition, join: ProjectionJoinRecord, path: string, context: ProjectionJoinValidationContext): void {
        const from = definition.From as FromRecord[] ?? [];
        const removed = definition.RemovedWith as RemovedWithRecord[] ?? [];
        if ([...from, ...removed].some(entry => entry.Key.Id === join.Key.Id)) {
            context.reject(path, 'events shared between Join and From or RemovedWith require a kernel-backed test');
        }
    }

    private static checkAutoMap(join: ProjectionJoinRecord, path: string, context: ProjectionJoinValidationContext): void {
        if (![AutoMap.Inherit, AutoMap.Enabled, AutoMap.Disabled].includes(join.Value.AutoMap ?? AutoMap.Inherit)) {
            context.reject(`${path}.AutoMap`, 'unknown join AutoMap settings require a kernel-backed test');
        }
    }

    private static checkCaseCollisions(schema: JsonSchema, path: string, context: ProjectionJoinValidationContext): void {
        const names = Object.keys(schema.properties ?? {});
        for (const [index, name] of names.entries()) {
            if (names.slice(index + 1).some(other => other.toLowerCase() === name.toLowerCase())) {
                context.reject(path, 'case-insensitively colliding join event properties require a kernel-backed test');
            }
        }
    }

    private static checkJoinMappings(join: ProjectionJoinRecord, schema: JsonSchema, mappings: Record<string, string>, path: string, context: ProjectionJoinValidationContext): void {
        if (!Object.keys(mappings).length) context.reject(path, 'joins without effective property mappings require a kernel-backed test');
        for (const [property, expression] of Object.entries(mappings)) {
            const mappingPath = `${path}.${Object.hasOwn(join.Value.Properties ?? {}, property) ? 'Properties' : 'AutoMap'}.${property}`;
            if (property === join.Value.On) context.reject(mappingPath, 'a join cannot map its own join target in scenarios; this requires a kernel-backed test');
            this.checkStringMapping(schema, expression, mappingPath, context);
            context.checkMapping(context.schema, schema, property, expression, mappingPath);
        }
    }

    private static checkFromMappings(definition: ProjectionDefinition, join: ProjectionJoinRecord, mappings: Record<string, string>, path: string, context: ProjectionJoinValidationContext): void {
        let hasJoinTarget = false;
        for (const entry of definition.From as FromRecord[] ?? []) {
            const fromPath = eventContractPath('From', entry.Key);
            const eventSchema = context.requireEventSchema(entry.Key, fromPath);
            const properties = this.fromProperties(definition, entry, eventSchema, context.schema);
            hasJoinTarget ||= Object.hasOwn(properties, join.Value.On);
            this.checkFromProperties(properties, entry, eventSchema, mappings, fromPath, context);
        }
        if (!hasJoinTarget) context.reject(`${path}.On`, 'joins require a From mapping for the join target; join-only projections require a kernel-backed test');
    }

    private static fromProperties(definition: ProjectionDefinition, entry: FromRecord, eventSchema: JsonSchema, schema: JsonSchema): Record<string, string> {
        const properties = { ...entry.Value.Properties };
        if (definition.AutoMap === AutoMap.Disabled) return properties;
        for (const source of Object.keys(eventSchema.properties ?? {})) {
            const destination = Object.keys(schema.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
            if (destination && this.canAutoMap(definition, properties, destination)) properties[destination] = source;
        }
        return properties;
    }

    private static canAutoMap(definition: ProjectionDefinition, properties: Record<string, string>, destination: string): boolean {
        return !Object.keys(properties).some(name => name.toLowerCase() === destination.toLowerCase())
            && !(definition.NoAutoMapProperties ?? []).some(name => name.toLowerCase() === destination.toLowerCase());
    }

    private static checkFromProperties(properties: Record<string, string>, entry: FromRecord, schema: JsonSchema, mappings: Record<string, string>, path: string, context: ProjectionJoinValidationContext): void {
        for (const [property, expression] of Object.entries(properties)) {
            const mappingPath = `${path}.${Object.hasOwn(entry.Value.Properties ?? {}, property) ? 'Properties' : 'AutoMap'}.${property}`;
            if (Object.hasOwn(mappings, property)) context.reject(mappingPath, 'From and Join mapping the same property requires a kernel-backed test');
            this.checkStringMapping(schema, expression, mappingPath, context);
        }
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
