// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;

using System.Collections.Immutable;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using KernelServiceAccessor = KernelContracts::Cratis.Chronicle.Contracts.IChronicleServicesAccessor;
using KernelBatchRequest = KernelContracts::Cratis.Chronicle.Contracts.Sequences.AppendManyForEventSourcesRequest;
using KernelBatchEvent = KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventForEventSourceId;
using KernelEventType = KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventType;
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
