// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../../eventSequences/EventSequenceId.js';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { ContractEventType, FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import { getEventTypeMapKey } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { UnsupportedProjectionOperation } from './UnsupportedProjectionOperation.js';

/** Validates *all* subscribed operations against the bounded scenario subset, before replay. */
export class ProjectionCapabilities {
    /**
     * Throws with the original declaration and contract path for the first unsupported operation.
     * @param compiled - Definitions and their schema/provenance evidence.
     * @param definition - The compiled contract to validate.
     */
    static validate(compiled: CompiledProjectionDefinitions, definition: ProjectionDefinition): void {
        const model = String(definition.ReadModel ?? definition.Identifier ?? '<unknown>');
        const wire = definition as unknown as Record<string, unknown>;
        const reject = (path: string, reason: string, fallback?: string) : never => {
            const source = compiled.provenance.get(definition)?.find(entry => entry.contractPath.startsWith('From['))?.declaration ?? '.from';
            const declaration = compiled.provenance.get(definition)?.find(entry => entry.contractPath === path)?.declaration
                ?? fallback ?? (path.includes('.AutoMap.') ? `${source} (AutoMap)`
                    : path.startsWith('InitialModelState') ? '.withInitialValues'
                        : path.startsWith('ReadModel') ? source : 'contract');
            throw new UnsupportedProjectionOperation(model, path, declaration, reason);
        };
        if (!compiled.definitions.includes(definition)) reject('Definition', 'definition is not part of this compile');
        const provenance = compiled.provenance.get(definition) ?? reject('Definition', 'capability provenance is unavailable');
        const catalog = compiled.eventSchemas.get(definition) ?? reject('Definition', 'event-schema catalog is unavailable');
        const variant = provenance.find(entry => entry.contractPath === 'Variant');
        if (variant) reject('Variant', 'variants require a kernel-backed test');
        if (wire.IsActive === false) reject('IsActive', 'passive projections require a kernel-backed test');
        if (wire.SubscribesToAllEvents === true) reject('SubscribesToAllEvents', 'subscribe-to-all projections require a kernel-backed test');
        if (wire.EventSequenceId !== EventSequenceId.eventLog.value) reject('EventSequenceId', 'non-default event sequences require a kernel-backed test');
        for (const section of ['Join', 'Children', 'Nested', 'RemovedWithJoin'] as const) {
            const value = wire[section];
            const paths = Array.isArray(value) ? value.map((entry: { Key: ContractEventType }) => eventContractPath(section, entry.Key))
                : Object.keys(value as Record<string, unknown> ?? {}).map(property => `${section}.${property}`);
            if (paths.length) reject(paths[0], `${section === 'Children' ? 'children projections' : section === 'Nested' ? 'nested projections' : section === 'Join' ? 'joins' : 'removedWithJoin'} require a kernel-backed test`);
        }
        if ((wire.FromEvery as unknown[] | undefined)?.length) reject('FromEvery', 'derivative projections require a kernel-backed test');
        if (wire.FromEventProperty) reject('FromEventProperty', 'event-property subscriptions require a kernel-backed test');
        const all = wire.All as { Properties?: Record<string, string>; IncludeChildren?: boolean; AutoMap?: AutoMap } | undefined;
        if (provenance.some(entry => entry.contractPath === 'All') || all?.IncludeChildren ||
            Object.keys(all?.Properties ?? {}).length || all?.AutoMap === AutoMap.Enabled) {
            reject('All', 'fromEvery/all subscriptions require a kernel-backed test');
        }

        const readModel = compiled.readModels.find(candidate => candidate.Type.Identifier === model)
            ?? reject('ReadModel', 'a single registered read-model schema is required');
        let schema: JsonSchema;
        try {
            schema = JSON.parse(readModel.Schema) as JsonSchema;
        } catch {
            reject('ReadModel.Schema', 'read-model schema is not valid JSON');
        }
        const identifier = schema!.properties?.id;
        if (!identifier || !((identifier.type === 'string' && (!identifier.format || identifier.format === 'guid')) ||
            (identifier.type === 'number' && identifier.format === 'double'))) {
            reject('ReadModel.Schema.id', 'only a lowercase id with a fixture-backed string, GUID, or number/double schema is supported; other identifiers require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        }
        const names = Object.keys(schema!.properties ?? {});
        for (const [index, name] of names.entries()) {
            if (names.slice(index + 1).some(other => other.toLowerCase() === name.toLowerCase())) {
                reject(`ReadModel.Schema.${name}`, 'case-insensitively colliding read-model properties require a kernel-backed test (ChronicleKernelScenario / live kernel)');
            }
        }
        let initial: unknown;
        try { initial = JSON.parse(String(wire.InitialModelState ?? '{}')); } catch { reject('InitialModelState', 'initial values must be a JSON object'); }
        if (initial === null || typeof initial !== 'object' || Array.isArray(initial)) reject('InitialModelState', 'initial values must be a JSON object');
        for (const [property, value] of Object.entries(initial as Record<string, unknown>)) {
            const target = schema!.properties?.[property]
                ?? reject(`InitialModelState.${property}`, 'initial value has no read-model schema');
            this.checkSchema(target, `InitialModelState.${property}`, reject);
            this.checkInitialValue(value, target, `InitialModelState.${property}`, reject);
        }
        const generations = new Map<string, number>();
        const requireEventSchema = (eventType: ContractEventType, path: string): JsonSchema => {
            const previous = generations.get(eventType.Id);
            if (previous !== undefined && previous !== eventType.Generation) reject(path, 'multiple generations of the same event-type id require a kernel-backed test');
            generations.set(eventType.Id, eventType.Generation);
            const event = catalog.get(getEventTypeMapKey(eventType)) ?? reject(path, 'participating event schema is unavailable');
            return event.schema;
        };
        const from = wire.From as FromRecord[] ?? [];
        const removedWith = wire.RemovedWith as RemovedWithRecord[] ?? [];
        for (const entry of from) {
            if (removedWith.some(removal => removal.Key.Id === entry.Key.Id)) {
                reject(eventContractPath('From', entry.Key), 'events subscribed through both From and RemovedWith require a kernel-backed test (ChronicleKernelScenario / live kernel)');
            }
        }
        for (const entry of [...from, ...removedWith]) {
            const section = from.includes(entry as FromRecord) ? 'From' : 'RemovedWith';
            const path = eventContractPath(section, entry.Key);
            const eventSchema = requireEventSchema(entry.Key, path);
            if (entry.Value.Key !== '$eventSourceId') reject(`${path}.Key`, 'only $eventSourceId keys are supported');
            if (entry.Value.ParentKey) reject(`${path}.ParentKey`, 'parent keys require a kernel-backed test');
            if (section === 'RemovedWith') continue;
            const properties = (entry as FromRecord).Value.Properties ?? {};
            for (const [property, expression] of Object.entries(properties)) {
                const mappingPath = `${path}.Properties.${property}`;
                this.checkMapping(schema!, eventSchema, property, expression, mappingPath, reject);
            }
            if (wire.AutoMap !== AutoMap.Disabled) {
                this.checkAutoMap(schema!, eventSchema, properties, wire.NoAutoMapProperties as string[] ?? [], path, reject);
            }
        }
    }

    private static checkAutoMap(
        modelSchema: JsonSchema, eventSchema: JsonSchema, explicit: Record<string, string>, exclusions: string[],
        path: string, reject: (path: string, reason: string) => never
    ): void {
        for (const [destination] of Object.entries(modelSchema.properties ?? {})) {
            if (Object.keys(explicit).some(name => name.toLowerCase() === destination.toLowerCase()) ||
                exclusions.some(name => name.toLowerCase() === destination.toLowerCase())) continue;
            const candidates = Object.keys(eventSchema.properties ?? {}).filter(source => source.toLowerCase() === destination.toLowerCase());
            if (candidates.length > 1) reject(`${path}.AutoMap.${destination}`, `inferred AutoMap source is ambiguous: ${candidates.join(', ')}`);
            if (candidates.length) this.checkMapping(modelSchema, eventSchema, destination, candidates[0], `${path}.AutoMap.${destination}`, reject);
        }
    }

    private static checkMapping(
        modelSchema: JsonSchema, eventSchema: JsonSchema, destination: string, expression: string,
        path: string, reject: (path: string, reason: string) => never
    ): void {
        const fail = (reason: string): never => reject(path, `expression '${expression}': ${reason}`);
        const target = modelSchema.properties?.[destination]
            ?? fail('dynamic or unknown destination paths require a kernel-backed test');
        if (destination.includes('.') || destination.includes('$')) fail('dynamic or unknown destination paths require a kernel-backed test');
        if (destination.toLowerCase() === 'id' || Object.keys(modelSchema.properties ?? {}).some(name =>
            name !== destination && name.toLowerCase() === destination.toLowerCase())) {
            fail('identifier or case-insensitively colliding target mappings require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        }
        if (target.type === 'object' || target.type === 'array') fail('object/array target mappings require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        this.checkSchema(target, path, (_path, reason) => fail(reason));
        if (expression === '$eventSourceId') {
            if (target.type !== 'string' || (target.format && target.format !== 'guid')) {
                fail('$eventSourceId requires a string or GUID target; other targets require a kernel-backed test (ChronicleKernelScenario / live kernel)');
            }
            return;
        }
        if (expression === '$null') return;
        if (expression.startsWith('$eventContext(')) {
            if (expression === '$eventContext(Occurred)') fail('raw Occurred is converted inconsistently by the kernel; only its Year, Month and Day paths are supported');
            if (/^\$eventContext\(.+\(\)\)$/.test(expression)) fail('derived event-context functions require a kernel-backed test');
            const path = /^\$eventContext\(([^()]*)\)$/.exec(expression)?.[1];
            const strings = ['EventSourceId', 'EventStore', 'Namespace', 'EventSourceType', 'EventStreamType',
                'EventStreamId', 'Subject', 'Subject.Value', 'Hash', 'CorrelationId', 'CorrelationId.Value',
                'CausedBy.Subject', 'CausedBy.Name', 'CausedBy.UserName', 'EventType.Id.Value', 'SequenceNumber', 'SequenceNumber.Value'];
            const integers = ['Occurred.Year', 'Occurred.Month', 'Occurred.Day', 'EventType.Generation.Value'];
            if (path && ((strings.includes(path) && target.type === 'string' && !target.format) ||
                (integers.includes(path) && target.type === 'integer' && target.format === 'int32'))) return;
            fail('event-context path and target schema require a kernel-backed test');
        }
        if (/^\$value\([\p{L}\p{Mn}\p{Nd}\p{Pc} ._/:*+-]*\)$/u.test(expression)) {
            const text = expression.slice(7, -1);
            if (target.format === 'date-time') fail('$value date-time literals require a kernel-backed test');
            if (this.numeric(target)) {
                if (!(target.type === 'integer' ? /^[+-]?\d+$/.test(text) : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) || !Number.isFinite(Number(text)) ||
                    (target.type === 'integer' && (!Number.isSafeInteger(Number(text)) ||
                        (target.format === 'int32' && (Number(text) < -2147483648 || Number(text) > 2147483647)) ||
                        (target.format === 'uint32' && (Number(text) < 0 || Number(text) > 4294967295))))) {
                    fail('$value numeric literal is outside the supported finite/integer range');
                }
            } else if (target.type === 'boolean' && !/^(?:true|false)$/i.test(text)) {
                fail('$value boolean literal must be true or false');
            } else if (target.format === 'guid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
                fail('$value GUID literal is not canonical');
            } else if (target.type === 'object' || target.type === 'array') {
                fail('$value object/array literals require a kernel-backed test');
            }
            return;
        }
        const operation = /^(\$add|\$subtract)\(([^()]+)\)$/.exec(expression);
        const arithmetic = operation || ['$count', '$increment', '$decrement'].includes(expression);
        if (arithmetic) fail('arithmetic requires a kernel-backed test (ChronicleKernelScenario / live kernel)');
        if (/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/.test(expression)) {
            if (['true', 'True', 'false', 'False'].includes(expression)) {
                fail('kernel resolves this expression as a boolean literal before event content');
            }
            const source = this.propertyAt(eventSchema, expression);
            if (!source) return fail(`event property '${expression}' is absent from the participating event schema`);
            this.checkSchema(source, path, (_path, reason) => fail(reason));
            if (!this.compatible(source, target)) {
                fail(`source '${expression}' (${source.type}${source.format ? `/${source.format}` : ''}) to target '${destination}' (${target.type}${target.format ? `/${target.format}` : ''}) requires a kernel-backed test`);
            }
            return;
        }
        if (expression.startsWith('$context.')) {
            return fail('is a legacy expression the kernel does not resolve; event-context mappings use $eventContext(...)');
        }
        fail('requires a kernel-backed test');
    }

    private static compatible(source: JsonSchema, target: JsonSchema): boolean {
        if (JSON.stringify(source.type) === JSON.stringify(target.type) && source.format === target.format) {
            return source.type !== 'object' && source.type !== 'array';
        }
        if (source.type === 'string' && !source.format && Array.isArray(target.type) &&
            target.type[0] === 'string' && target.type[1] === 'null') return true;
        if (source.type === 'string' && !source.format &&
            ((target.type === 'number' && (!target.format || target.format === 'double')) ||
                (target.type === 'integer' && ['int32', 'uint32'].includes(target.format ?? '')))) return true;
        if (source.type === 'string' && source.format === 'guid' && target.type === 'string' && !target.format) return true;
        return source.type === 'integer' && ['int32', 'uint32'].includes(source.format ?? '') &&
            target.type === 'number' && (!target.format || target.format === 'double');
    }

    private static checkInitialValue(value: unknown, target: JsonSchema, path: string, reject: (path: string, reason: string) => never): void {
        if (value === null && Array.isArray(target.type) && target.type.includes('null')) return;
        if (target.type === 'object' || target.type === 'array' || target.format === 'date-time') {
            reject(path, 'initial object, array, or date-time values require a kernel-backed test');
        }
        if (target.type === 'integer' || target.type === 'number') {
            if (typeof value !== 'number') reject(path, 'initial numeric value must be a JSON number');
            const outsideIntegerRange = !Number.isSafeInteger(value) ||
                (target.format === 'int32' && (value < -2147483648 || value > 2147483647)) ||
                (target.format === 'uint32' && (value < 0 || value > 4294967295));
            if (!Number.isFinite(value) || (target.type === 'integer' && outsideIntegerRange)) {
                reject(path, 'initial numeric value is outside the supported finite/integer range');
            }
        } else if (target.type === 'boolean') {
            if (typeof value !== 'boolean') reject(path, 'initial boolean value must be a JSON boolean');
        } else if (target.type === 'string' || Array.isArray(target.type)) {
            if (typeof value !== 'string') reject(path, 'initial string value must be a JSON string');
            if (target.format === 'guid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
                reject(path, 'initial GUID value must be canonical lowercase text');
            }
        } else reject(path, 'initial value requires a kernel-backed test');
    }

    private static propertyAt(schema: JsonSchema, path: string): JsonSchema | undefined {
        return path.split('.').reduce<JsonSchema | undefined>((current, segment) => current?.properties?.[segment], schema);
    }

    private static numeric(schema: JsonSchema): boolean {
        return (schema.type === 'number' && (!schema.format || schema.format === 'double')) ||
            (schema.type === 'integer' && ['int32', 'uint32'].includes(schema.format ?? ''));
    }

    private static checkSchema(schema: JsonSchema, path: string, reject: (path: string, reason: string) => never): void {
        if (schema.compliance?.length || schema.security?.length) reject(path, 'protected fields require a kernel-backed test');
        if (!schema.type || schema.type === 'null' || (Array.isArray(schema.type) &&
            (schema.type.length !== 2 || schema.type[0] !== 'string' || schema.type[1] !== 'null')) ||
            (schema.format && !['guid', 'date-time', 'double', 'int32', 'uint32'].includes(schema.format)) ||
            (schema.format === 'date-time' && schema.type !== 'string') ||
            (schema.format === 'guid' && schema.type !== 'string') ||
            (schema.format === 'double' && schema.type !== 'number') ||
            (['int32', 'uint32'].includes(schema.format ?? '') && schema.type !== 'integer')) {
            reject(path, `schema type/format '${schema.type ?? 'unknown'}${schema.format ? `/${schema.format}` : ''}' requires a kernel-backed test`);
        }
        if (schema.type === 'integer' && !this.numeric(schema)) reject(path, 'integer width requires a kernel-backed test');
        if (schema.type === 'array' && schema.items) this.checkSchema(schema.items, path, reject);
        if (schema.type === 'object') {
            for (const property of Object.values(schema.properties ?? {})) this.checkSchema(property, path, reject);
        }
    }
}
