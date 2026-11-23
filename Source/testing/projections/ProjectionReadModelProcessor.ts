// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import { deserializeReadModel } from '../../readModels/deserializeReadModel.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { IReadModelProcessor } from '../IReadModelProcessor.js';
import type { ReadModelState } from '../ReadModelState.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import { ProjectionArithmetic } from './ProjectionArithmetic.js';
import { ProjectionCapabilities } from './ProjectionCapabilities.js';
import { ProjectionExpressionEvaluator } from './ProjectionExpressionEvaluator.js';
import { ProjectionJoins } from './ProjectionJoins.js';
import { ProjectionJoinChildrenCapabilities } from './ProjectionJoinChildrenCapabilities.js';
import type { ProjectionJoinRecord } from './ProjectionJoinRecord.js';
import { ProjectionRootMappings } from './ProjectionRootMappings.js';
import { ProjectionRootKeyCapabilities } from './ProjectionRootKeyCapabilities.js';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';
import { ProjectionValueChildrenCapabilities } from './ProjectionValueChildrenCapabilities.js';
import { ProjectionContextChildKeyCapabilities } from './ProjectionContextChildKeyCapabilities.js';
import { UnsupportedProjectionOperation } from './UnsupportedProjectionOperation.js';

interface ChildBinding {
    readonly property: string;
    readonly identifiedBy: string;
    readonly key: string;
    readonly from: FromRecord | undefined;
    readonly items: JsonSchema;
    readonly valueProperty?: string;
}

interface ProjectionInput {
    readonly event: ScenarioEvent;
    readonly content: unknown;
    readonly schema: JsonSchema;
}

interface ProjectionReplay<TReadModel extends object> {
    readonly states: Map<string, ReadModelState<TReadModel>>;
    readonly engine: Record<string, Record<string, unknown>>;
    readonly joinedEvents: Map<string, { event: ScenarioEvent; content: unknown }>;
}

/** In-process interpreter of the validated, registered projection contract subset. */
export class ProjectionReadModelProcessor<TReadModel extends object> implements IReadModelProcessor<TReadModel> {
    private readonly _schema: JsonSchema;
    private readonly _initial: Record<string, unknown>;
    private readonly _from: ReadonlyMap<string, FromRecord>;
    private readonly _removed: ReadonlySet<string>;
    private readonly _join: ProjectionJoinRecord | undefined;
    private readonly _joinProperties: Record<string, string>;
    private readonly _children: ReadonlyMap<string, ChildBinding>;
    private readonly _eventSchemas: ReadonlyMap<string, JsonSchema>;
    private readonly _bindings: ReadonlyMap<string, { generation: number; path: string; declaration: string }>;
    private _engineState: Record<string, Record<string, unknown>> = {};
    private _publicRead: Record<string, Record<string, unknown>> = {};

    constructor(private readonly _model: Constructor<TReadModel>, compiled: CompiledProjectionDefinitions, private readonly _definition: ProjectionDefinition) {
        ProjectionCapabilities.validate(compiled, _definition);
        const registration = compiled.readModels.find(entry => entry.Type.Identifier === _definition.ReadModel)!;
        this._schema = JSON.parse(registration.Schema) as JsonSchema;
        this._initial = JSON.parse(_definition.InitialModelState || '{}') as Record<string, unknown>;
        const wire = _definition as unknown as { From: FromRecord[]; RemovedWith: RemovedWithRecord[]; Children?: Record<string, ChildrenDefinitionLike> };
        this._from = new Map((wire.From ?? []).map(entry => [entry.Key.Id, entry]));
        this._removed = new Set((wire.RemovedWith ?? []).map(entry => entry.Key.Id));
        const declarationFor = (path: string) => compiled.provenance.get(_definition)?.find(provenance => provenance.contractPath === path)?.declaration;
        const bindings = [...(wire.From ?? []), ...(wire.RemovedWith ?? [])].map(entry => {
            const section = (wire.From ?? []).includes(entry as FromRecord) ? 'From' : 'RemovedWith';
            const path = eventContractPath(section, entry.Key);
            return [entry.Key.Id, { generation: entry.Key.Generation, path, declaration: declarationFor(path) ?? 'contract' }] as const;
        });
        this._join = _definition.Join?.[0] as ProjectionJoinRecord | undefined;
        if (this._join) {
            const path = eventContractPath('Join', this._join.Key);
            bindings.push([this._join.Key.Id, { generation: this._join.Key.Generation, path, declaration: declarationFor(path) ?? 'contract' }]);
        }
        const children = new Map<string, ChildBinding>();
        for (const [property, child] of Object.entries(wire.Children ?? {})) {
            const items = this._schema.properties![property].items!;
            const value = ProjectionValueChildrenCapabilities.definition(child);
            if (value) {
                children.set(value.Event.Id, { property, items, valueProperty: value.PropertyExpression, identifiedBy: '', key: '', from: undefined });
            }
            for (const entry of [...child.From, ...child.RemovedWith]) {
                const from = child.From.includes(entry as FromRecord) ? entry as FromRecord : undefined;
                const path = `Children.${property}.${eventContractPath(from ? 'From' : 'RemovedWith', entry.Key)}`;
                children.set(entry.Key.Id, { property, identifiedBy: child.IdentifiedBy, key: entry.Value.Key, from, items });
                if (!bindings.some(([id]) => id === entry.Key.Id)) {
                    bindings.push([entry.Key.Id, { generation: entry.Key.Generation, path, declaration: declarationFor(`Children.${property}`) ?? 'contract' }]);
                }
            }
        }
        this._children = children;
        this._bindings = new Map(bindings);
        this._eventSchemas = new Map([...(compiled.eventSchemas.get(_definition) ?? new Map()).values()]
            .map(entry => [entry.eventType.Id, entry.schema]));
        this._joinProperties = this._join ? ProjectionJoins.properties(_definition, this._eventSchemas.get(this._join.Key.Id)!, this._schema) : {};
    }

    /** A snapshot of the production-style in-memory sink, for kernel conformance fixtures. */
    get engineState(): Record<string, Record<string, unknown>> { return structuredClone(this._engineState); }
    /** A schema-normalized keyed read, for kernel conformance fixtures. */
    get publicRead(): Record<string, Record<string, unknown>> { return structuredClone(this._publicRead); }

    async process(events: readonly ScenarioEvent[]): Promise<Map<string, ReadModelState<TReadModel>>> {
        this.validateContextChildHistory(events);
        ProjectionJoinChildrenCapabilities.validateHistory(this._definition, events, (path, reason) => {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), path, 'contract', reason);
        });
        for (const event of events) this.rootKey(event);
        const states = new Map<string, ReadModelState<TReadModel>>();
        const engine: Record<string, Record<string, unknown>> = Object.create(null);
        // Replay-local event-sequence lookup. Removal deletes a root, never its joined source history.
        const joinedEvents = new Map<string, { event: ScenarioEvent; content: unknown }>();
        for (const event of events) this.processEvent(event, { states, engine, joinedEvents });
        this._engineState = engine;
        this._publicRead = Object.fromEntries(Object.entries(engine).map(([key, value]) => [key, this.normalize(value)]));
        return states;
    }

    private validateContextChildHistory(events: readonly ScenarioEvent[]): void {
        const contextChildren = new Map([...this._children].filter(([, child]) => ProjectionContextChildKeyCapabilities.matches(child.key)));
        if (!contextChildren.size) return;
        const initialized = new Set<string>();
        for (const event of events) {
            const typeId = event.context.eventType.id.value;
            if (this._removed.has(typeId)) initialized.delete(event.sourceId);
            else if (this._from.has(typeId)) initialized.add(event.sourceId);
            const child = contextChildren.get(typeId);
            if (child && !initialized.has(event.sourceId)) {
                this.rejectUninitializedParent(event, child);
            }
        }
    }

    private rejectUninitializedParent(event: ScenarioEvent, child: ChildBinding): never {
        const binding = this.bindingFor(event);
        const operation = child.from ? 'creation' : 'removal';
        throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
            `event-context child ${operation} before parent '${event.sourceId}' is initialized is not fixture-backed; use a kernel-backed test`);
    }

    private processEvent(event: ScenarioEvent, replay: ProjectionReplay<TReadModel>): void {
        const { engine, states, joinedEvents } = replay;
        const typeId = event.context.eventType.id.value;
        const from = this._from.get(typeId);
        const removed = this._removed.has(typeId);
        const child = this._children.get(typeId);
        const joining = this._join?.Key.Id === typeId;
        if (![from, removed, child, joining].some(Boolean)) {
            this.processAllEvent(event, engine, states);
            return;
        }
        const binding = this.bindingFor(event);
        if (joining) {
            this.processJoin(event, replay);
            return;
        }
        const source = this.rootKey(event);
        const key = this.keyFor(source);
        if (removed) {
            delete engine[key];
            states.set(event.sourceId, { instance: null, deleted: true });
            return;
        }
        const schema = this._eventSchemas.get(typeId)!;
        this.checkLocalHash(event, from, schema, binding);
        const content = ProjectionValueConverter.eventContent(event.content, schema);
        const state = this.stateForEvent(key, event, from, engine);
        const input = { event, content, schema };
        if (from) this.applyRoot(from, input, state, joinedEvents);
        if (child) this.applyChild(child, { input, state, binding });
        // InMemorySink.ApplyChanges always restores lowercase id after applying mappings.
        state.id = ProjectionValueConverter.convert(key, this._schema.properties!.id);
        engine[key] = state;
        states.set(source, { instance: this.materialize(state), deleted: false });
    }

    private rootKey(event: ScenarioEvent): string {
        return ProjectionRootKeyCapabilities.key(this._definition, event, (path, reason) => {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), path, 'contract', reason);
        });
    }

    private processJoin(event: ScenarioEvent, { engine, states, joinedEvents }: ProjectionReplay<TReadModel>): void {
        const schema = this._eventSchemas.get(event.context.eventType.id.value)!;
        const content = ProjectionValueConverter.eventContent(event.content, schema);
        joinedEvents.set(event.sourceId, { event, content });
        // SetInitialState skips join events: changes are computed against an empty state.
        // Consequently a missing/null string produces no change, even on a populated row.
        const changes: Record<string, unknown> = Object.create(null);
        this.apply(this._joinProperties, { event, content, schema }, this._schema, changes);
        for (const [key, state] of Object.entries(engine)) {
            if (state[this._join!.Value.On] !== event.sourceId) continue;
            Object.assign(state, changes);
            states.set(key, { instance: this.materialize(state), deleted: false });
        }
    }

    private checkLocalHash(event: ScenarioEvent, from: FromRecord | undefined, schema: JsonSchema, binding: { path: string; declaration: string }): void {
        // EventScenario hashes client JSON, not kernel-normalized numeric/Guid/date/object JSON.
        if (!event.scenarioLocalHash || !from) return;
        const mapsHash = Object.values(from.Value.Properties ?? {}).some(expression => /^\$eventContext\(Hash(?:\.Value)?\)$/.test(expression));
        const hasUnprovenField = Object.values(schema.properties ?? {}).some(property =>
            !['string', 'boolean'].includes(property.type ?? '') || property.format !== undefined);
        if (mapsHash && hasUnprovenField) {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                'observed Hash mappings for numeric, Guid, date or object event fields are not fixture-backed; use a kernel-backed test');
        }
    }

    private stateForEvent(key: string, event: ScenarioEvent, from: FromRecord | undefined, engine: Record<string, Record<string, unknown>>): Record<string, unknown> {
        const state = engine[key];
        // Content-keyed children can create an uninitialized parent; context-keyed histories are preflighted.
        if (!state) return from ? this.initialState(key, event) : this.identityState(key, event, false);
        if (state.__initialized === false && from) {
            for (const [name, value] of Object.entries(this.initialValues())) if (!(name in state)) state[name] = value;
            state.__initialized = true;
        }
        return state;
    }

    private applyRoot(from: FromRecord, input: ProjectionInput, state: Record<string, unknown>, joinedEvents: ProjectionReplay<TReadModel>['joinedEvents']): void {
        const properties = this.rootProperties(from, input.schema);
        this.apply(properties, input, this._schema, state);
        // ResolveJoin is wired only to From clauses that map the join target (including AutoMap).
        if (!this._join || !Object.hasOwn(properties, this._join.Value.On)) return;
        const onValue = state[this._join.Value.On];
        const joined = typeof onValue === 'string' ? joinedEvents.get(onValue) : undefined;
        if (joined) this.apply(this._joinProperties, { ...joined, schema: this._eventSchemas.get(joined.event.context.eventType.id.value)! }, this._schema, state);
    }

    private bindingFor(event: ScenarioEvent) {
        const binding = this._bindings.get(event.context.eventType.id.value)!;
        if (event.context.eventType.generation.value !== binding.generation) {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                `seeded event generation ${event.context.eventType.generation.value} differs from subscribed generation ${binding.generation}; multi-generation history requires a kernel-backed test`);
        }
        return binding;
    }

    private processAllEvent(event: ScenarioEvent, engine: Record<string, Record<string, unknown>>, states: Map<string, ReadModelState<TReadModel>>): void {
        if (!this._definition.SubscribesToAllEvents) return;
        const key = this.keyFor(event.sourceId);
        const state = engine[key] ?? this.initialState(key, event);
        // This bounded All block reads only SequenceNumber, never the undeclared payload or AutoMap.
        this.apply(this._definition.All!.Properties, { event, content: event.content, schema: this._schema }, this._schema, state);
        engine[key] = state;
        states.set(event.sourceId, { instance: this.materialize(state), deleted: false });
    }

    private rootProperties(from: FromRecord, schema: JsonSchema): Record<string, string> {
        const explicit = ProjectionRootMappings.explicit(this._definition, from);
        const excluded = this._definition.NoAutoMapProperties ?? [];
        return ProjectionRootMappings.usesAutoMap(this._definition, explicit)
            ? this.withAutoMap(explicit, schema, this._schema, excluded) : explicit;
    }

    private keyFor(source: string): string {
        const identifier = this._schema.properties!.id;
        const canonical = String(ProjectionValueConverter.convert(source, identifier));
        if (identifier.format === 'guid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(source)) {
            throw new RangeError(`Projection event source '${source}' is not a canonical GUID identifier.`);
        }
        if (canonical !== source) throw new RangeError(`Projection event source '${source}' is not a canonical ${identifier.type} identifier.`);
        return canonical;
    }

    private applyChild(child: ChildBinding, update: { input: ProjectionInput; state: Record<string, unknown>; binding: { path: string; declaration: string } }): void {
        const { input, state, binding } = update;
        const { content, schema: eventSchema } = input;
        if (child.valueProperty) {
            this.appendValueChild(child, content, state, binding);
            return;
        }
        const identity = this.childIdentity(child, input, binding);
        const collection = (state[child.property] ??= []) as Record<string, unknown>[];
        const index = collection.findIndex(item => item[child.identifiedBy] === identity);
        if (!child.from) {
            if (index >= 0) collection.splice(index, 1);
            return;
        }
        const item = index >= 0 ? collection[index] : { [child.identifiedBy]: identity };
        if (index < 0) collection.push(item);
        // Validation admits only the identifier mapping explicitly; other fields come from same-name AutoMap.
        // Kernel AutoMap is schema-driven: an untyped child item schema maps nothing (children-untyped-items).
        const properties = child.items.properties ? this.withAutoMap({}, eventSchema, child.items, [child.identifiedBy]) : {};
        this.apply(properties, input, child.items, item);
    }

    private childIdentity(child: ChildBinding, input: ProjectionInput, binding: { path: string; declaration: string }): string {
        const identity = ProjectionContextChildKeyCapabilities.value(child.key, input.content, input.event.context);
        if (typeof identity !== 'string') {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                `child key '${child.key}' has no string value in the seeded event; missing child keys require a kernel-backed test`);
        }
        return identity;
    }

    private appendValueChild(child: ChildBinding, content: unknown, state: Record<string, unknown>, binding: { path: string; declaration: string }): void {
        const value = ProjectionExpressionEvaluator.pathValue(content, child.valueProperty!);
        if (typeof value !== 'string') {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                `value child property '${child.valueProperty}' has no string value in the seeded event; missing or null value children require a kernel-backed test`);
        }
        const collection = (state[child.property] ??= []) as string[];
        collection.push(value);
    }

    private withAutoMap(explicit: Record<string, string>, eventSchema: JsonSchema, target: JsonSchema, exclusions: readonly string[]): Record<string, string> {
        const properties = { ...explicit };
        const mapped = new Set([...Object.keys(properties), ...exclusions].map(name => name.toLowerCase()));
        for (const source of Object.keys(eventSchema.properties ?? {})) {
            const destination = Object.keys(target.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
            if (destination && !mapped.has(destination.toLowerCase())) {
                properties[destination] = source;
                mapped.add(destination.toLowerCase());
            }
        }
        return properties;
    }

    private apply(properties: Record<string, string>, { content, event }: ProjectionInput, target: JsonSchema, state: Record<string, unknown>): void {
        for (const [destination, expression] of Object.entries(properties)) {
            const arithmetic = ProjectionArithmetic.isArithmetic(expression);
            const value = arithmetic
                ? ProjectionArithmetic.value(expression, content, target.properties![destination], state[destination])
                : ProjectionExpressionEvaluator.value(expression, content, event.context, target.properties![destination]);
            // Zero arithmetic on an absent accumulator is no change, just like null on an absent scalar.
            if (this.isZeroInitialization(arithmetic, value, state[destination])) continue;
            if (value !== null || state[destination] !== undefined) state[destination] = value;
        }
    }

    private isZeroInitialization(arithmetic: boolean, value: unknown, current: unknown): boolean {
        return arithmetic && value === 0 && current === undefined;
    }

    private initialValues(): Record<string, unknown> {
        const initial: Record<string, unknown> = Object.create(null);
        if (Object.keys(this._initial).length) {
            return Object.assign(initial, ProjectionValueConverter.convert(structuredClone(this._initial), this._schema, false, false));
        }
        for (const [name, property] of Object.entries(this._schema.properties ?? {})) {
            if (property.type === 'array') initial[name] = [];
        }
        return initial;
    }

    private initialState(key: string, event: ScenarioEvent): Record<string, unknown> {
        return Object.assign(this.initialValues(), this.identityState(key, event, true));
    }

    private identityState(key: string, event: ScenarioEvent, initialized: boolean): Record<string, unknown> {
        const state: Record<string, unknown> = Object.create(null);
        state.id = ProjectionValueConverter.convert(key, this._schema.properties!.id);
        state.__subject = event.context.subject ?? this.rootKey(event);
        state.__initialized = initialized;
        return state;
    }

    private normalize(state: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = Object.create(null);
        for (const [name, schema] of Object.entries(this._schema.properties ?? {})) {
            const value = state[name] ?? ProjectionValueConverter.defaultValue(schema);
            if (value !== undefined && value !== null) result[name] = value;
        }
        return result;
    }

    private materialize(state: Record<string, unknown>): TReadModel {
        return deserializeReadModel(this._model, JSON.stringify(this.normalize(state)));
    }
}
