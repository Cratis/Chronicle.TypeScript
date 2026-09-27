// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Immutable;
using System.Reflection;
using System.Text.Json.Nodes;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Events;
using Cratis.Execution;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Testing.EventSequences;
using Cratis.Chronicle.Observation;

namespace ProjectionOracle;

[EventType("OracleEventRecorded")]
public record OracleEventRecorded(string Name, bool Active);

[EventType("AlternateRecorded")]
public record AlternateRecorded(string Label);

internal static class EventScenarioOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        using var scenario = new EventScenario();
        var actions = fixture["actions"]!.AsArray();
        var results = new JsonArray();
        foreach (var action in actions)
        {
            var source = action!["source"]!.GetValue<string>();
            object value = action["type"]?.GetValue<string>() == "alternate"
                ? new AlternateRecorded(action["label"]!.GetValue<string>())
                : new OracleEventRecorded(action["name"]!.GetValue<string>(), action["active"]!.GetValue<bool>());
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
                ["content"] = entry.Content is AlternateRecorded alternate
                    ? new JsonObject { ["label"] = alternate.Label }
                    : new JsonObject {
                        ["name"] = ((OracleEventRecorded)entry.Content).Name,
                        ["active"] = ((OracleEventRecorded)entry.Content).Active
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
}
