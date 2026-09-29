// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;
extern alias KernelConcepts;
extern alias KernelStorage;

using System.Collections.Immutable;
using System.Text.Json;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using KernelServiceAccessor = KernelContracts::Cratis.Chronicle.Contracts.IChronicleServicesAccessor;
using KernelAppendRequest = KernelContracts::Cratis.Chronicle.Contracts.Sequences.AppendRequest;
using KernelBatchRequest = KernelContracts::Cratis.Chronicle.Contracts.Sequences.AppendManyForEventSourcesRequest;
using KernelBatchEvent = KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventForEventSourceId;
using KernelEventType = KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventType;
using KernelStore = KernelStorage::Cratis.Chronicle.Storage.IStorage;
using KernelUnique = KernelConcepts::Cratis.Chronicle.Concepts.Events.Constraints.UniqueConstraintDefinition;
using KernelUniqueType = KernelConcepts::Cratis.Chronicle.Concepts.Events.Constraints.UniqueEventTypeConstraintDefinition;
using KernelStoreName = KernelConcepts::Cratis.Chronicle.Concepts.EventStoreName;
using Cratis.Chronicle;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Execution;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Testing.EventSequences;
using Cratis.Chronicle.Observation;
using Cratis.Chronicle.EventSequences.Concurrency;

namespace ProjectionOracle;

[EventType("OracleEventRecorded")]
public record OracleEventRecorded(string Name, bool Active);

[EventType("AlternateRecorded")]
public record AlternateRecorded(string Label);

[EventType("BoundaryRecorded")]
public record BoundaryRecorded(string FirstName, string Label);

[EventType("BatchUniqueRecorded")]
public record BatchUniqueRecorded([property: Unique("BatchUniqueKey")] string Key);

[EventType("OracleDomainText")]
public record OracleDomainText(string Key);

[EventType("OracleDomainShared")]
public record OracleDomainShared(string Key);

[EventType("OracleDomainFlag")]
public record OracleDomainFlag(bool Key);

[EventType("OracleDomainRemoved")]
public record OracleDomainRemoved(string Label);

[EventType("OracleDomainExpired")]
public record OracleDomainExpired(string Label);

[EventType("OracleDomainCleared")]
public record OracleDomainCleared();

[EventType("OracleCycleFirst")]
public record OracleCycleFirst(string Label);

[EventType("OracleCycleSibling")]
public record OracleCycleSibling(string Label);

[EventType("OracleCycleRemoved")]
public record OracleCycleRemoved(string Label);

[EventType("OracleCycleExpired")]
public record OracleCycleExpired(string Label);

[EventType("OracleCycleRenewed")]
public record OracleCycleRenewed(string Label);

// The fixture explicitly selects the definitions installed in the packaged testing scenario.
// No constraint validation is implemented here: the packaged kernel owns that operation.
sealed class OracleConstraintProvider(ImmutableArray<IConstraintDefinition> definitions) : ICanProvideConstraints
{
    public IImmutableList<IConstraintDefinition> Provide() => definitions;
}

[EventType("OracleKeyClaimed")]
public record OracleKeyClaimed([property: Unique("OracleKey", "Already claimed: {PropertyName}={PropertyValue}")] string Key);

[EventType("OracleKeyShared")]
public record OracleKeyShared([property: Unique("OracleKey")] string Key);

[EventType("OracleOnceRecorded")]
[Unique("OracleOnce")]
public record OracleOnceRecorded(string Label);

[EventType("OracleOnceShared")]
public record OracleOnceShared(string Label);

[EventType("OracleNamedOnce")]
[Unique("OracleNamedOnce", "Already recorded this kind of event")]
public record OracleNamedOnce(string Label);

[EventType("OracleFluentOnce")]
public record OracleFluentOnce(string Label);

public class OracleFluentOnceConstraint : IConstraint
{
    public void Define(IConstraintBuilder builder) => builder.Unique<OracleFluentOnce>(name: "OracleFluentOnceConstraint");
}

internal static class EventScenarioOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        if (fixture["isolatedConstraintOperations"] is JsonArray) return await RunIsolatedConstraints(fixture);
        if (fixture["constraintOperations"] is JsonArray) return await RunConstraints(fixture);
        if (fixture["routeCases"] is JsonArray) return await RunOmittedRoutes(fixture);
        if (fixture["operations"] is JsonArray) return await RunBatches(fixture);
        using var scenario = new EventScenario();
        var actions = fixture["actions"]!.AsArray();
        var results = new JsonArray();
        foreach (var action in actions)
        {
            var source = action!["source"]!.GetValue<string>();
            object value = action["type"]?.GetValue<string>() switch
            {
                "alternate" => new AlternateRecorded(action["label"]!.GetValue<string>()),
                "boundary" => new BoundaryRecorded(action["firstName"]!.GetValue<string>(), action["label"]!.GetValue<string>()),
                _ => new OracleEventRecorded(action["name"]!.GetValue<string>(), action["active"]!.GetValue<bool>())
            };
            // The .NET client ordinarily sends its own root. For this fixture, put the
            // TypeScript client's two entries on the same ambient chain the .NET client sends.
            var ambient = (AsyncLocal<List<Causation>>)typeof(CausationManager)
                .GetField("_current", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
            var previous = ambient.Value;
            if (action["clientCausation"]?.GetValue<bool>() == true)
            {
                ambient.Value = [
                    new Causation(DateTimeOffset.UtcNow, CausationType.Root, ImmutableDictionary<string, string>.Empty),
                    new Causation(DateTimeOffset.UtcNow, new CausationType("TypeScriptClient.Append"),
                        ImmutableDictionary<string, string>.Empty.Add("eventType", action["type"]?.GetValue<string>() == "alternate" ? "AlternateRecorded" : "OracleEventRecorded"))
                ];
            }
            AppendResult result;
            try
            {
                result = action["correlationId"] is not null
                    ? await scenario.EventLog.Append(source, value,
                        correlationId: (CorrelationId)Guid.Parse(action["correlationId"]!.GetValue<string>()),
                        occurred: DateTimeOffset.Parse(action["occurred"]!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture))
                    : await scenario.EventLog.Append(source, value);
            }
            finally
            {
                ambient.Value = previous!;
            }
            string? waitError = null;
            try { await result.WaitForCompletion(); }
            catch (Exception exception) { waitError = exception.GetType().Name; }
            results.Add(new JsonObject {
                ["success"] = result.IsSuccess,
                ["sequenceNumber"] = result.SequenceNumber.Value.ToString(),
                ["violations"] = result.ConstraintViolations.Count(),
                ["errors"] = result.Errors.Count(),
                ["concurrencyViolation"] = result.ConcurrencyViolation is not null,
                ["waitError"] = waitError
            });
        }
        var events = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First);
        var history = new JsonArray();
        var index = 0;
        foreach (var entry in events)
        {
            var action = actions[index++]!;
            history.Add(new JsonObject
            {
                ["sequenceNumber"] = entry.Context.SequenceNumber.Value.ToString(),
                ["source"] = entry.Context.EventSourceId.Value,
                ["sourceType"] = entry.Context.EventSourceType.Value,
                ["streamType"] = entry.Context.EventStreamType.Value,
                ["streamId"] = entry.Context.EventStreamId.Value,
                ["subject"] = entry.Context.Subject.Value,
                ["store"] = entry.Context.EventStore.Value,
                ["namespace"] = entry.Context.Namespace.Value,
                ["occurredValid"] = entry.Context.Occurred.Year > 2020,
                ["explicitOccurred"] = action["occurred"] is null ? null : entry.Context.Occurred.ToString("O"),
                ["explicitCorrelation"] = action["correlationId"] is null ? null : entry.Context.CorrelationId.Value.ToString(),
                ["correlationValid"] = Guid.TryParse(entry.Context.CorrelationId.Value.ToString(), out _),
                ["causationCount"] = entry.Context.Causation.Count(),
                ["causation"] = new JsonArray(entry.Context.Causation.Select(item => (JsonNode?)new JsonObject {
                    ["type"] = item.Type.Name,
                    ["properties"] = new JsonObject(item.Properties.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
                }).ToArray()),
                ["observationState"] = (int)entry.Context.ObservationState,
                ["tagsCount"] = entry.Context.Tags.Count(),
                ["causedByName"] = entry.Context.CausedBy.Name,
                ["eventType"] = entry.Context.EventType.Id.Value,
                ["generation"] = entry.Context.EventType.Generation.Value,
                ["hash"] = entry.Context.Hash.Value,
                ["content"] = entry.Content switch
                {
                    AlternateRecorded alternate => new JsonObject { ["label"] = alternate.Label },
                    BoundaryRecorded boundary => new JsonObject { ["firstName"] = boundary.FirstName, ["label"] = boundary.Label },
                    OracleEventRecorded recorded => new JsonObject { ["name"] = recorded.Name, ["active"] = recorded.Active },
                    _ => throw new InvalidOperationException("Unexpected event content")
                }
            });
        }
        var sourceA = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, "A");
        var fromOne = await scenario.EventLog.GetFromSequenceNumber((EventSequenceNumber)1UL);
        var byType = await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("OracleEventRecorded", 1)]);
        return new JsonObject {
            ["sourceA"] = new JsonArray(sourceA.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["byType"] = new JsonArray(byType.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailA"] = (await scenario.EventLog.GetTailSequenceNumber("A")).Value.ToString(),
            ["fromOne"] = new JsonArray(fromOne.Select(item => (JsonNode?)JsonValue.Create(item.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["results"] = results,
            ["history"] = history,
            ["next"] = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString(),
            ["tail"] = (await scenario.EventLog.GetTailSequenceNumber()).Value.ToString(),
            ["hasSourceA"] = await scenario.EventLog.HasEventsFor("A")
        };
    }

    // Every operation goes through the packaged testing client and its in-process kernel.
    // Include both wire-facing violation details and committed history to prove rollback.
    static async Task<JsonNode> RunConstraints(JsonObject fixture)
    {
        using var scenario = new EventScenario();
        var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
        var services = ((KernelServiceAccessor)created[1]!).Services;
        var outcomes = new JsonArray();
        foreach (var operation in fixture["constraintOperations"]!.AsArray())
        {
            var events = operation!["events"]!.AsArray().Select(item => new EventForEventSourceId(
                item!["source"]!.GetValue<string>(), item["type"]!.GetValue<string>() switch
                {
                    "key" => new OracleKeyClaimed(item["value"]!.GetValue<string>()),
                    "plain" => new BatchUniqueRecorded(item["value"]!.GetValue<string>()),
                    "shared" => new OracleKeyShared(item["value"]!.GetValue<string>()),
                    "once" => new OracleOnceRecorded(item["value"]!.GetValue<string>()),
                    "onceShared" => new OracleOnceShared(item["value"]!.GetValue<string>()),
                    "fluentOnce" => new OracleFluentOnce(item["value"]!.GetValue<string>()),
                    "namedOnce" => new OracleNamedOnce(item["value"]!.GetValue<string>()),
                    _ => throw new InvalidOperationException("Unknown constraint fixture event")
                })).ToArray();
            var single = operation["mode"]!.GetValue<string>() == "single";
            if (single && events.Length != 1) throw new InvalidOperationException("Single fixture must contain exactly one event.");
            if (single)
            {
                var result = await scenario.EventLog.Append(events[0].EventSourceId, events[0].Event);
                outcomes.Add(new JsonObject
                {
                    ["success"] = result.IsSuccess,
                    ["sequences"] = new JsonArray(JsonValue.Create(result.SequenceNumber.Value.ToString())),
                    ["violations"] = Violations(result.ConstraintViolations),
                    ["errors"] = new JsonArray(result.Errors.Select(error => (JsonNode?)JsonValue.Create(error.Value)).ToArray())
                });
            }
            else
            {
                var result = await scenario.EventLog.AppendMany(events);
                outcomes.Add(new JsonObject
                {
                    ["success"] = result.IsSuccess,
                    ["sequences"] = new JsonArray(result.SequenceNumbers.Select(number => (JsonNode?)JsonValue.Create(number.Value.ToString())).ToArray()),
                    ["violations"] = Violations(result.ConstraintViolations),
                    ["errors"] = new JsonArray(result.Errors.Select(error => (JsonNode?)JsonValue.Create(error.Value)).ToArray())
                });
            }
            // Re-send only rejected operations directly to the same kernel state. A rejection cannot
            // commit; this captures the actual contract fields before the .NET client maps messages.
            JsonArray wireViolations = new();
            if (!outcomes[^1]!["success"]!.GetValue<bool>())
            {
                var rawEvents = operation["events"]!.AsArray().Select(item => new KernelBatchEvent
                {
                    EventSourceId = item!["source"]!.GetValue<string>(),
                    EventType = new KernelEventType { Id = item["type"]!.GetValue<string>() switch
                    {
                        "key" => "OracleKeyClaimed", "shared" => "OracleKeyShared", "plain" => "BatchUniqueRecorded",
                        "once" => "OracleOnceRecorded", "fluentOnce" => "OracleFluentOnce", "namedOnce" => "OracleNamedOnce",
                        _ => throw new InvalidOperationException("Unknown constraint fixture event")
                    }, Generation = 1 },
                    Content = item["type"]!.GetValue<string>() is "key" or "shared" or "plain"
                        ? System.Text.Json.JsonSerializer.Serialize(new { key = item["value"]!.GetValue<string>() })
                        : System.Text.Json.JsonSerializer.Serialize(new { label = item["value"]!.GetValue<string>() }),
                    Subject = item["source"]!.GetValue<string>()
                }).ToArray();
                var raw = single
                    ? (await services.Sequences.Append(new KernelAppendRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log",
                        EventSourceId = rawEvents[0].EventSourceId, EventType = rawEvents[0].EventType,
                        Content = rawEvents[0].Content, Subject = rawEvents[0].Subject
                    })).Response?.ConstraintViolations
                    : (await services.Sequences.AppendManyForEventSources(new KernelBatchRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log",
                        Events = rawEvents
                    })).Response?.ConstraintViolations;
                if (raw is null || !raw.Any()) throw new InvalidOperationException("Rejected constraint operation had no raw kernel violations.");
                wireViolations = WireViolations(raw);
            }
            outcomes[^1]!["wireViolations"] = wireViolations;
            var committed = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First);
            outcomes[^1]!["history"] = new JsonArray(committed.Select(entry => (JsonNode?)new JsonObject
            {
                ["sequence"] = entry.Context.SequenceNumber.Value.ToString(),
                ["source"] = entry.Context.EventSourceId.Value,
                ["type"] = entry.Context.EventType.Id.Value,
                ["value"] = entry.Content switch
                {
                    OracleKeyClaimed key => key.Key,
                    BatchUniqueRecorded plain => plain.Key,
                    OracleKeyShared shared => shared.Key,
                    OracleOnceRecorded once => once.Label,
                    OracleOnceShared once => once.Label,
                    OracleFluentOnce once => once.Label,
                    OracleNamedOnce once => once.Label,
                    _ => throw new InvalidOperationException("Unexpected constrained history")
                }
            }).ToArray());
            outcomes[^1]!["next"] = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
        }
        return new JsonObject { ["outcomes"] = outcomes };
    }

    // Keep the increment-4 regression runner intact. This runner accepts an explicit fixture
    // definition and schema catalog, so adding another oracle case never installs global definitions.
    static async Task<JsonNode> RunIsolatedConstraints(JsonObject fixture)
    {
        if (fixture["isolatedConstraintOperations"]!.AsArray().Count == 0)
            throw new InvalidOperationException("Isolated constraint fixture must contain operations.");
        var schema = fixture["eventSchemas"]!.AsObject();
        var allowed = new Dictionary<string, (Type Type, string? Property, string? SchemaType)>
        {
            ["string"] = (typeof(OracleDomainText), "key", "string"),
            ["shared"] = (typeof(OracleDomainShared), "key", "string"),
            ["boolean"] = (typeof(OracleDomainFlag), "key", "boolean"),
            ["removed"] = (typeof(OracleDomainRemoved), "label", "string"),
            ["expired"] = (typeof(OracleDomainExpired), "label", "string"),
            ["cleared"] = (typeof(OracleDomainCleared), null, null),
            ["first"] = (typeof(OracleCycleFirst), "label", "string"),
            ["sibling"] = (typeof(OracleCycleSibling), "label", "string"),
            ["cycleRemoved"] = (typeof(OracleCycleRemoved), "label", "string"),
            ["cycleExpired"] = (typeof(OracleCycleExpired), "label", "string"),
            ["renewed"] = (typeof(OracleCycleRenewed), "label", "string")
        };
        var known = allowed.Where(pair => schema.ContainsKey(pair.Key)).ToDictionary();
        if (schema.Count == 0 || schema.Count != known.Count ||
            known.Any(pair => schema[pair.Key]?["eventTypeId"]?.GetValue<string>() != pair.Value.Type.Name ||
                schema[pair.Key]?["properties"] is not JsonObject properties ||
                properties.Count != (pair.Value.Property is null ? 0 : 1) ||
                (pair.Value.Property is not null && properties[pair.Value.Property]?.GetValue<string>() != pair.Value.SchemaType)))
            throw new InvalidOperationException("Isolated constraint fixture must declare exactly the installed event schemas.");
        var definitions = fixture["constraintDefinitions"]!.AsArray().Select(node =>
        {
            var name = node!["name"]!.GetValue<string>();
            if (node["kind"]?.GetValue<string>() == "uniqueEventType")
            {
                if (node["events"] is not null || node["ignoreCasing"] is not null ||
                    node["eventTypes"] is not JsonArray types || types.Count == 0 ||
                    node["removedWithEventTypeIds"] is not JsonArray removalTypes)
                    throw new InvalidOperationException($"Unsupported event-type fixture definition for {name}.");
                var covered = types.Select(item => item!.GetValue<string>()).ToArray();
                var cycleRemovals = removalTypes.Select(item => item!.GetValue<string>()).ToArray();
                if (covered.Distinct().Count() != covered.Length || cycleRemovals.Distinct().Count() != cycleRemovals.Length ||
                    covered.Any(alias => !known.ContainsKey(alias)) || cycleRemovals.Any(alias => !known.ContainsKey(alias)))
                    throw new InvalidOperationException($"Unknown or repeated event-type fixture alias for {name}.");
                var cycleMessage = node["message"]?.GetValue<string>() ?? "";
                return (IConstraintDefinition)new UniqueEventTypeConstraintDefinition(name, _ => cycleMessage,
                    covered.Select(alias => (EventTypeId)known[alias].Type.Name).ToArray(),
                    cycleRemovals.Select(alias => (EventTypeId)known[alias].Type.Name).ToArray());
            }
            var events = node["events"]!.AsArray().Select(entry =>
            {
                var alias = entry!["type"]!.GetValue<string>();
                if (!known.TryGetValue(alias, out var kind) || entry["properties"] is not JsonArray properties ||
                    properties.Count != 1 || properties[0]?.GetValue<string>() != kind.Property)
                    throw new InvalidOperationException($"Unsupported fixture definition for {name}.");
                return new UniqueConstraintEventDefinition(kind.Type.Name, [kind.Property!]);
            }).ToArray();
            if (events.Length == 0 || events.Select(entry => entry.EventTypeId.Value).Distinct().Count() != events.Length ||
                node["kind"]?.GetValue<string>() != "uniqueProperty" || node["ignoreCasing"]?.GetValue<bool>() != false ||
                node["removedWithEventTypeIds"] is not JsonArray removalNames)
                throw new InvalidOperationException($"Unsupported fixture definition for {name}.");
            var removals = removalNames.Select(item => item!.GetValue<string>()).ToArray();
            if (removals.Distinct().Count() != removals.Length || removals.Any(alias =>
                !known.TryGetValue(alias, out var kind) ||
                (kind.Property == "key" && !events.Any(entry => entry.EventTypeId.Value == kind.Type.Name))))
                throw new InvalidOperationException($"Unsupported fixture removal for {name}.");
            var message = node["message"]?.GetValue<string>() ?? "";
            return (IConstraintDefinition)new UniqueConstraintDefinition(name, _ => message, events,
                removals.Select(alias => (EventTypeId)known[alias].Type.Name).ToArray(), false);
        }).ToImmutableArray();
        if (definitions.Length == 0 || definitions.Select(definition => definition.Name.Value).Distinct().Count() != definitions.Length)
            throw new InvalidOperationException("Fixture definitions must be present and have distinct names.");
        using var scenario = new EventScenario(new OracleConstraintProvider(definitions));
        var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
        var services = ((KernelServiceAccessor)created[1]!).Services;
        var storage = (KernelStore)(services.Sequences.GetType().GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
            .Single(field => field.FieldType == typeof(KernelStore)).GetValue(services.Sequences)
            ?? throw new InvalidOperationException("Packaged sequence service has no kernel storage."));
        var installed = (await storage.GetEventStore((KernelStoreName)"test-event-store").Constraints.GetDefinitions()).ToArray();
        if (installed.Length != definitions.Length) throw new InvalidOperationException("Fixture definitions were not all installed.");
        foreach (var (definition, index) in definitions.Select((value, index) => (value, index)))
        {
            if (definition is UniqueEventTypeConstraintDefinition uniqueType)
            {
                if (installed[index] is not KernelUniqueType actualType || actualType.Name.Value != definition.Name.Value ||
                    actualType.Scope is not null ||
                    !actualType.EventTypeIds.Select(id => id.Value).SequenceEqual(uniqueType.EventTypeIds.Select(id => id.Value)) ||
                    !actualType.RemovedWith.Select(id => id.Value).SequenceEqual(uniqueType.RemovedWith.Select(id => id.Value)))
                    throw new InvalidOperationException($"Installed kernel event-type definition does not match fixture {definition.Name.Value}.");
                continue;
            }
            if (installed[index] is not KernelUnique actual || actual.Name.Value != definition.Name.Value ||
                actual.IgnoreCasing || actual.Scope is not null ||
                !actual.RemovedWith.Select(id => id.Value).SequenceEqual(
                    fixture["constraintDefinitions"]![index]!["removedWithEventTypeIds"]!.AsArray()
                        .Select(alias => known[alias!.GetValue<string>()].Type.Name)) ||
                !actual.EventDefinitions.Select(entry => (entry.EventTypeId.Value, Properties: string.Join(",", entry.Properties)))
                    .SequenceEqual(((UniqueConstraintDefinition)definition).EventsWithProperties.Select(entry =>
                        (entry.EventTypeId.Value, Properties: string.Join(",", entry.Properties)))))
                throw new InvalidOperationException($"Installed kernel definition does not match fixture {definition.Name.Value}.");
        }
        var outcomes = new JsonArray();
        foreach (var operation in fixture["isolatedConstraintOperations"]!.AsArray())
        {
            var before = await History();
            var nextBefore = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
            var entries = operation!["events"]!.AsArray();
            var events = entries.Select(entry =>
            {
                var alias = entry!["type"]!.GetValue<string>();
                if (!known.ContainsKey(alias) || entry["source"] is null ||
                    (known[alias].Property is not null && entry["value"] is null) ||
                    (known[alias].Property is null && entry["value"] is not null))
                    throw new InvalidOperationException("Unknown fixture event or missing value.");
                object value = alias switch
                {
                    "string" => new OracleDomainText(entry["value"]!.GetValue<string>()),
                    "shared" => new OracleDomainShared(entry["value"]!.GetValue<string>()),
                    "boolean" => new OracleDomainFlag(entry["value"]!.GetValue<bool>()),
                    "removed" => new OracleDomainRemoved(entry["value"]!.GetValue<string>()),
                    "expired" => new OracleDomainExpired(entry["value"]!.GetValue<string>()),
                    "cleared" => new OracleDomainCleared(),
                    "first" => new OracleCycleFirst(entry["value"]!.GetValue<string>()),
                    "sibling" => new OracleCycleSibling(entry["value"]!.GetValue<string>()),
                    "cycleRemoved" => new OracleCycleRemoved(entry["value"]!.GetValue<string>()),
                    "cycleExpired" => new OracleCycleExpired(entry["value"]!.GetValue<string>()),
                    "renewed" => new OracleCycleRenewed(entry["value"]!.GetValue<string>()),
                    _ => throw new InvalidOperationException("Unknown fixture event.")
                };
                var options = operation["options"];
                return new EventForEventSourceId(entry["source"]!.GetValue<string>(), value)
                {
                    EventSourceType = entry["sourceType"]?.GetValue<string>() ?? options?["sourceType"]?.GetValue<string>() ?? "Default",
                    EventStreamType = entry["streamType"]?.GetValue<string>() ?? options?["streamType"]?.GetValue<string>() ?? "All",
                    EventStreamId = entry["streamId"]?.GetValue<string>() ?? options?["streamId"]?.GetValue<string>() ?? "Default",
                    Subject = entry["subject"]?.GetValue<string>() ?? options?["subject"]?.GetValue<string>() ?? entry["source"]!.GetValue<string>()
                };
            }).ToArray();
            var single = operation["mode"]?.GetValue<string>() == "single";
            if (events.Length == 0 || single && events.Length != 1 || !single && operation["mode"]?.GetValue<string>() != "batch")
                throw new InvalidOperationException("Expected nonempty single or batch constraint operation.");
            bool success;
            JsonArray sequences;
            JsonArray violations;
            JsonArray errors;
            if (single)
            {
                var first = entries[0]!;
                var options = operation["options"];
                var result = await scenario.EventLog.Append(events[0].EventSourceId, events[0].Event,
                    eventSourceType: first["sourceType"] is null && options?["sourceType"] is null ? null :
                        (EventSourceType)(first["sourceType"]?.GetValue<string>() ?? options!["sourceType"]!.GetValue<string>()),
                    eventStreamType: first["streamType"] is null && options?["streamType"] is null ? null :
                        (EventStreamType)(first["streamType"]?.GetValue<string>() ?? options!["streamType"]!.GetValue<string>()),
                    eventStreamId: first["streamId"] is null && options?["streamId"] is null ? null :
                        (EventStreamId)(first["streamId"]?.GetValue<string>() ?? options!["streamId"]!.GetValue<string>()),
                    subject: first["subject"] is null && options?["subject"] is null ? null :
                        (Subject)(first["subject"]?.GetValue<string>() ?? options!["subject"]!.GetValue<string>()));
                success = result.IsSuccess;
                sequences = new JsonArray(JsonValue.Create(result.SequenceNumber.Value.ToString()));
                violations = Violations(result.ConstraintViolations);
                errors = new JsonArray(result.Errors.Select(error => (JsonNode?)JsonValue.Create(error.Value)).ToArray());
            }
            else
            {
                var result = await scenario.EventLog.AppendMany(events);
                success = result.IsSuccess;
                sequences = new JsonArray(result.SequenceNumbers.Select(number => (JsonNode?)JsonValue.Create(number.Value.ToString())).ToArray());
                violations = Violations(result.ConstraintViolations);
                errors = new JsonArray(result.Errors.Select(error => (JsonNode?)JsonValue.Create(error.Value)).ToArray());
            }
            var wireViolations = new JsonArray();
            if (!success)
            {
                if (violations.Count == 0 || errors.Count != 0)
                    throw new InvalidOperationException("Expected a constraint rejection, not another append failure.");
                var rawEvents = entries.Select(entry =>
                {
                    var alias = entry!["type"]!.GetValue<string>();
                    var options = operation["options"];
                    var wire = new KernelBatchEvent
                    {
                        EventSourceId = entry["source"]!.GetValue<string>(),
                        EventType = new KernelEventType { Id = known[alias].Type.Name, Generation = 1 },
                        Content = entry["type"]!.GetValue<string>() switch
                        {
                            "removed" or "expired" or "first" or "sibling" or "cycleRemoved" or "cycleExpired" or "renewed" =>
                                JsonSerializer.Serialize(new { label = entry["value"]!.DeepClone() }),
                            "cleared" => "{}",
                            _ => JsonSerializer.Serialize(new { key = entry["value"]!.DeepClone() })
                        },
                        Subject = entry["subject"]?.GetValue<string>() ?? options?["subject"]?.GetValue<string>() ?? entry["source"]!.GetValue<string>()
                    };
                    // Preserve omission separately from explicit empty strings in the raw request.
                    if ((entry["sourceType"] ?? options?["sourceType"]) is JsonNode sourceType) wire.EventSourceType = sourceType.GetValue<string>();
                    if ((entry["streamType"] ?? options?["streamType"]) is JsonNode streamType) wire.EventStreamType = streamType.GetValue<string>();
                    if ((entry["streamId"] ?? options?["streamId"]) is JsonNode streamId) wire.EventStreamId = streamId.GetValue<string>();
                    return wire;
                }).ToArray();
                // A rejected request cannot commit. The raw request gets the original durable
                // history and captures the actual kernel contract before the client maps messages.
                var raw = single
                    ? (await services.Sequences.Append(new KernelAppendRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log",
                        EventSourceId = rawEvents[0].EventSourceId, EventType = rawEvents[0].EventType,
                        Content = rawEvents[0].Content, Subject = rawEvents[0].Subject,
                        EventSourceType = rawEvents[0].EventSourceType, EventStreamType = rawEvents[0].EventStreamType,
                        EventStreamId = rawEvents[0].EventStreamId
                    })).Response?.ConstraintViolations
                    : (await services.Sequences.AppendManyForEventSources(new KernelBatchRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", Events = rawEvents
                    })).Response?.ConstraintViolations;
                if (raw is null || !raw.Any()) throw new InvalidOperationException("Rejected operation had no raw kernel violations.");
                wireViolations = WireViolations(raw);
            }
            var history = await History();
            var next = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
            if (!success && (!JsonNode.DeepEquals(before, history) || nextBefore != next))
                throw new InvalidOperationException("A rejected constraint operation changed history or the next sequence.");
            outcomes.Add(new JsonObject
            {
                ["success"] = success, ["sequences"] = sequences, ["violations"] = violations, ["errors"] = errors,
                ["wireViolations"] = wireViolations, ["history"] = history, ["next"] = next
            });
        }
        return new JsonObject { ["outcomes"] = outcomes };

        async Task<JsonArray> History() => new((await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First))
            .Select(entry => (JsonNode?)new JsonObject
            {
                ["sequence"] = entry.Context.SequenceNumber.Value.ToString(),
                ["source"] = entry.Context.EventSourceId.Value,
                ["sourceType"] = entry.Context.EventSourceType.Value,
                ["streamType"] = entry.Context.EventStreamType.Value,
                ["streamId"] = entry.Context.EventStreamId.Value,
                ["type"] = entry.Context.EventType.Id.Value,
                ["content"] = entry.Content switch
                {
                    OracleDomainText text => new JsonObject { ["key"] = text.Key },
                    OracleDomainShared shared => new JsonObject { ["key"] = shared.Key },
                    OracleDomainFlag flag => new JsonObject { ["key"] = flag.Key },
                    OracleDomainRemoved removed => new JsonObject { ["label"] = removed.Label },
                    OracleDomainExpired expired => new JsonObject { ["label"] = expired.Label },
                    OracleDomainCleared => new JsonObject(),
                    OracleCycleFirst first => new JsonObject { ["label"] = first.Label },
                    OracleCycleSibling sibling => new JsonObject { ["label"] = sibling.Label },
                    OracleCycleRemoved removed => new JsonObject { ["label"] = removed.Label },
                    OracleCycleExpired expired => new JsonObject { ["label"] = expired.Label },
                    OracleCycleRenewed renewed => new JsonObject { ["label"] = renewed.Label },
                    _ => throw new InvalidOperationException("Unexpected constrained history")
                },
                ["hash"] = entry.Context.Hash.Value
            }).ToArray());
    }

    static JsonArray WireViolations(IEnumerable<KernelContracts::Cratis.Chronicle.Contracts.Events.Constraints.ConstraintViolation> violations) =>
        new(violations.Select(violation => (JsonNode?)new JsonObject
        {
            ["EventTypeId"] = violation.EventTypeId,
            ["SequenceNumber"] = violation.SequenceNumber.ToString(),
            ["ConstraintType"] = (int)violation.ConstraintType,
            ["ConstraintName"] = violation.ConstraintName,
            ["Message"] = violation.Message,
            ["Details"] = new JsonObject(violation.Details.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
        }).ToArray());

    static JsonArray Violations(IEnumerable<ConstraintViolation> violations) =>
        new(violations.Select(violation => (JsonNode?)new JsonObject
        {
            ["id"] = violation.ConstraintName.Value,
            ["message"] = violation.Message.Value,
            ["details"] = new JsonObject(violation.Details.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
        }).ToArray());

    // Bypass the .NET convenience type, which eagerly fills in routing defaults. This request
    // reaches the pinned in-process kernel service with truly absent or empty route fields.
    static async Task<JsonNode> RunOmittedRoutes(JsonObject fixture)
    {
        using var scenario = new EventScenario();
        var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
        var services = ((KernelServiceAccessor)created[1]!).Services;
        var cases = fixture["routeCases"]!.AsArray();
        if (cases.Count < 3 || !cases.Any(item => item!["sourceType"] is null && item["streamType"] is null && item["streamId"] is null) ||
            !cases.Any(item => item!["sourceType"]?.GetValue<string>() == "" && item["streamType"]?.GetValue<string>() == "" && item["streamId"]?.GetValue<string>() == ""))
            throw new InvalidOperationException("Omitted-route fixture must include both fully omitted and explicitly empty routes.");
        var request = new KernelBatchRequest
        {
            EventStore = "test-event-store",
            Namespace = "default",
            EventSequenceId = "event-log",
            Events = cases.Select(item =>
            {
                var wire = new KernelBatchEvent
                {
                    EventSourceId = item!["source"]!.GetValue<string>(),
                    EventType = new KernelEventType { Id = "OracleEventRecorded", Generation = 1 },
                    Content = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        name = item["name"]!.GetValue<string>(), active = item["active"]!.GetValue<bool>()
                    }),
                    Subject = item["source"]!.GetValue<string>()
                };
                // Leave absent route members at their contract defaults; send explicit empty members unchanged.
                if (item["sourceType"] is not null) wire.EventSourceType = item["sourceType"]!.GetValue<string>();
                if (item["streamType"] is not null) wire.EventStreamType = item["streamType"]!.GetValue<string>();
                if (item["streamId"] is not null) wire.EventStreamId = item["streamId"]!.GetValue<string>();
                return wire;
            }).ToArray()
        };
        if (request.Events.Any(item => item.EventSourceType is "Default" || item.EventStreamType is "All" || item.EventStreamId is "Default"))
            throw new InvalidOperationException("Omitted-route oracle must not supply route defaults.");
        var response = await services.Sequences.AppendManyForEventSources(request);
        if (response.Response?.IsSuccess != true || response.Response.SequenceNumbers.Count() != cases.Count)
            throw new InvalidOperationException($"Kernel omitted-route append failed: {string.Join(", ", response.ExceptionMessages)}");
        var history = await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First);
        return new JsonObject
        {
            ["sequences"] = new JsonArray(response.Response.SequenceNumbers.Select(number => (JsonNode?)JsonValue.Create(number.ToString())).ToArray()),
            ["routes"] = new JsonArray(history.Select(entry => (JsonNode?)new JsonObject
            {
                ["source"] = entry.Context.EventSourceId.Value,
                ["sourceType"] = entry.Context.EventSourceType.Value,
                ["streamType"] = entry.Context.EventStreamType.Value,
                ["streamId"] = entry.Context.EventStreamId.Value
            }).ToArray())
        };
    }

    // Batch fixtures use the real multi-source kernel append path: the TypeScript client sends
    // both overloads through AppendManyForEventSources. No in-memory validator is substituted.
    static async Task<JsonNode> RunBatches(JsonObject fixture)
    {
        using var scenario = new EventScenario();
        var notifications = new BatchNotificationObserver(() =>
            scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First).GetAwaiter().GetResult().Count());
        using var subscription = scenario.EventLog.AppendOperations.Subscribe(notifications);
        var outcomes = new JsonArray();
        foreach (var operation in fixture["operations"]!.AsArray())
        {
            var entries = operation!["events"]!.AsArray();
            var shared = operation["options"];
            var ambient = (AsyncLocal<List<Causation>>)typeof(CausationManager)
                .GetField("_current", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
            var previous = ambient.Value;
            if (operation["clientCausation"]?.GetValue<bool>() == true)
            {
                ambient.Value = [
                    new Causation(DateTimeOffset.UtcNow, CausationType.Root, ImmutableDictionary<string, string>.Empty),
                    new Causation(DateTimeOffset.UtcNow, new CausationType("TypeScriptClient.AppendMany"),
                        ImmutableDictionary<string, string>.Empty.Add("count", entries.Count.ToString()))
                ];
            }
            try
            {
            var events = entries.Select(entry => new EventForEventSourceId(
                entry!["source"]!.GetValue<string>(),
                entry["type"]?.GetValue<string>() switch {
                    "alternate" => new AlternateRecorded(entry["label"]!.GetValue<string>()),
                    "unique" => new BatchUniqueRecorded(entry["key"]!.GetValue<string>()),
                    _ => new OracleEventRecorded(entry["name"]!.GetValue<string>(), entry["active"]!.GetValue<bool>())
                })
            {
                EventSourceType = entry["sourceType"]?.GetValue<string>() ?? shared?["sourceType"]?.GetValue<string>() ?? "Default",
                EventStreamType = entry["streamType"]?.GetValue<string>() ?? shared?["streamType"]?.GetValue<string>() ?? "All",
                EventStreamId = entry["streamId"]?.GetValue<string>() ?? shared?["streamId"]?.GetValue<string>() ?? "Default",
                Subject = entry["subject"]?.GetValue<string>() ?? shared?["subject"]?.GetValue<string>() ?? entry["source"]!.GetValue<string>(),
                Occurred = entry["occurred"] is not null || shared?["occurred"] is not null
                    ? DateTimeOffset.Parse((entry["occurred"] ?? shared!["occurred"])!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture)
                    : null,
                Tags = entry["tags"] is JsonArray tags ? tags.Select(tag => tag!.GetValue<string>()).ToArray() : []
            }).ToArray();
            if (operation["overload"]?.GetValue<string>() == "given")
            {
                if (events.Select(item => item.EventSourceId).Distinct().Count() > 1) throw new InvalidOperationException("Given fixture must use one source.");
                await scenario.Given.ForEventSource(entries.Count == 0 ? "A" : events[0].EventSourceId).Events(events.Select(item => item.Event).ToArray());
                outcomes.Add(new JsonObject { ["given"] = events.Length });
                continue;
            }
            if (operation["overload"]?.GetValue<string>() == "whenSequential")
            {
                if (events.Length == 0 || events.Select(item => item.EventSourceId).Distinct().Count() != 1) throw new InvalidOperationException("When fixture needs one source.");
                var last = await scenario.When.ForEventSource(events[0].EventSourceId).Events(events[0].Event, events.Skip(1).Select(item => item.Event).ToArray());
                outcomes.Add(new JsonObject { ["sequentialSuccess"] = last.IsSuccess, ["lastSequence"] = last.SequenceNumber.Value.ToString() });
                continue;
            }
            if (events.Length == 0)
            {
                try { await scenario.EventLog.AppendMany(events); throw new InvalidOperationException("Empty batch unexpectedly succeeded."); }
                catch (Exception error) when (error.GetType().Name == "CommandFailed" && error.Message.Contains("At least one event is required.", StringComparison.Ordinal))
                {
                    outcomes.Add(new JsonObject { ["rejection"] = error.Message });
                }
                continue;
            }
            var result = await scenario.EventLog.AppendMany(events,
                correlationId: shared?["correlationId"] is null ? null : (CorrelationId)Guid.Parse(shared["correlationId"]!.GetValue<string>()),
                tags: shared?["tags"] is JsonArray sharedTags ? sharedTags.Select(tag => tag!.GetValue<string>()).ToArray() : []);
            outcomes.Add(new JsonObject {
                ["success"] = result.IsSuccess,
                ["sequences"] = new JsonArray(result.SequenceNumbers.Select(number => (JsonNode?)JsonValue.Create(number.Value.ToString())).ToArray()),
                ["violations"] = result.ConstraintViolations.Count(),
                ["violationIds"] = new JsonArray(result.ConstraintViolations.Select(item => (JsonNode?)JsonValue.Create(item.ConstraintName.Value)).ToArray()),
                ["errors"] = result.Errors.Count(),
                ["concurrencyViolation"] = result.ConcurrencyViolations.Any()
            });
            }
            finally { ambient.Value = previous!; }
        }
        var history = (await scenario.EventLog.GetFromSequenceNumber(EventSequenceNumber.First)).Select(entry => (JsonNode?)new JsonObject {
            ["sequence"] = entry.Context.SequenceNumber.Value.ToString(),
            ["store"] = entry.Context.EventStore.Value,
            ["namespace"] = entry.Context.Namespace.Value,
            ["observationState"] = (int)entry.Context.ObservationState,
            ["causedByName"] = entry.Context.CausedBy.Name,
            ["generation"] = entry.Context.EventType.Generation.Value,
            ["source"] = entry.Context.EventSourceId.Value,
            ["sourceType"] = entry.Context.EventSourceType.Value,
            ["streamType"] = entry.Context.EventStreamType.Value,
            ["streamId"] = entry.Context.EventStreamId.Value,
            ["subject"] = entry.Context.Subject.Value,
            ["occurredValid"] = entry.Context.Occurred.Year > 2020,
            ["explicitOccurred"] = fixture["operations"]!.AsArray().SelectMany(op => op!["events"]!.AsArray().Select(item =>
                item!["occurred"] ?? op["options"]?["occurred"])).Where(item => item is not null)
                .Any(item => DateTimeOffset.Parse(item!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture) == entry.Context.Occurred)
                ? entry.Context.Occurred.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") : null,
            ["correlationValid"] = Guid.TryParse(entry.Context.CorrelationId.Value.ToString(), out _),
            ["explicitCorrelation"] = entry.Context.CorrelationId.Value.ToString() == "00000000-0000-0000-0000-000000000000"
                ? null : entry.Context.CorrelationId.Value.ToString(),
            ["tags"] = new JsonArray(entry.Context.Tags.Select(tag => (JsonNode?)JsonValue.Create(tag.Value)).ToArray()),
            ["causation"] = new JsonArray(entry.Context.Causation.Select(item => (JsonNode?)new JsonObject {
                ["type"] = item.Type.Name,
                ["properties"] = new JsonObject(item.Properties.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
            }).ToArray()),
            ["hash"] = entry.Context.Hash.Value,
            ["type"] = entry.Context.EventType.Id.Value,
            ["content"] = entry.Content switch {
                AlternateRecorded alternate => new JsonObject { ["label"] = alternate.Label },
                BatchUniqueRecorded unique => new JsonObject { ["key"] = unique.Key },
                OracleEventRecorded recorded => new JsonObject { ["name"] = recorded.Name, ["active"] = recorded.Active },
                _ => throw new InvalidOperationException("Unexpected batch event content")
            }
        }).ToArray();
        return new JsonObject {
            ["outcomes"] = outcomes,
            ["notifications"] = new JsonArray(notifications.Batches.ToArray()),
            ["notificationHistoryLengths"] = new JsonArray(notifications.HistoryLengths.Select(count => (JsonNode?)JsonValue.Create(count)).ToArray()),
            ["history"] = new JsonArray(history),
            ["next"] = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString(),
            ["tail"] = (await scenario.EventLog.GetTailSequenceNumber()).Value.ToString(),
            ["tailA"] = (await scenario.EventLog.GetTailSequenceNumber("A")).Value.ToString(),
            ["tailByType"] = (await scenario.EventLog.GetTailSequenceNumber(filterEventTypes: [new EventType("AlternateRecorded", 1)])).Value.ToString(),
            ["fromOneByType"] = new JsonArray((await scenario.EventLog.GetFromSequenceNumber((EventSequenceNumber)1UL,
                filterEventTypes: [new EventType("AlternateRecorded", 1)])).Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["byRoute"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("OracleEventRecorded", 1)],
                eventStreamType: "All", eventStreamId: "Default", eventSourceType: "Default"))
                .Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["byAllStreamType"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("AlternateRecorded", 1)],
                eventStreamType: "All"))
                .Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["byDefaultRoute"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("B", [new EventType("OracleEventRecorded", 1)],
                eventStreamType: "All", eventStreamId: "Default", eventSourceType: "Default"))
                .Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailByAll"] = (await scenario.EventLog.GetTailSequenceNumber("A", eventStreamType: "All",
                filterEventTypes: [new EventType("AlternateRecorded", 1)])).Value.ToString(),
            ["byCustomRoute"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("B", [new EventType("OracleEventRecorded", 1)],
                eventStreamType: "Other", eventStreamId: "stream2", eventSourceType: "Custom"))
                .Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailByRoute"] = (await scenario.EventLog.GetTailSequenceNumber("B", "Custom", "Other", "stream2",
                [new EventType("OracleEventRecorded", 1)])).Value.ToString(),
            ["byStreamTypeOnly"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("AlternateRecorded", 1)],
                eventStreamType: "Archive")).Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailByStreamTypeOnly"] = (await scenario.EventLog.GetTailSequenceNumber("A", eventStreamType: "Archive")).Value.ToString(),
            ["byStreamIdOnly"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("AlternateRecorded", 1)],
                eventStreamId: "stream1")).Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailByStreamIdOnly"] = (await scenario.EventLog.GetTailSequenceNumber("A", eventStreamId: "stream1")).Value.ToString(),
            ["bySourceTypeOnly"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("B", [new EventType("OracleEventRecorded", 1)],
                eventSourceType: "Custom")).Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailBySourceTypeOnly"] = (await scenario.EventLog.GetTailSequenceNumber("B", eventSourceType: "Custom")).Value.ToString(),
            ["byMixedRoute"] = new JsonArray((await scenario.EventLog.GetForEventSourceIdAndEventTypes("A", [new EventType("AlternateRecorded", 1)],
                eventStreamType: "All", eventStreamId: "stream1")).Select(entry => (JsonNode?)JsonValue.Create(entry.Context.SequenceNumber.Value.ToString())).ToArray()),
            ["tailByMixedRoute"] = (await scenario.EventLog.GetTailSequenceNumber("A", eventStreamType: "All", eventStreamId: "stream1")).Value.ToString()
        };
    }

    sealed class BatchNotificationObserver : IObserver<IEnumerable<AppendedEventWithResult>>
    {
        readonly Func<int> _historyLength;
        public BatchNotificationObserver(Func<int> historyLength) => _historyLength = historyLength;
        public List<JsonNode> Batches { get; } = [];
        public List<int> HistoryLengths { get; } = [];
        public void OnCompleted() { }
        public void OnError(Exception error) => throw error;
        public void OnNext(IEnumerable<AppendedEventWithResult> values)
        {
            HistoryLengths.Add(_historyLength());
            Batches.Add(new JsonArray(values.Select(item => (JsonNode?)new JsonObject {
                ["sequence"] = item.Result.SequenceNumber.Value.ToString(),
                ["source"] = item.Event.Context.EventSourceId.Value,
                ["type"] = item.Event.Context.EventType.Id.Value,
                ["success"] = item.Result.IsSuccess
            }).ToArray()));
        }
    }
}
