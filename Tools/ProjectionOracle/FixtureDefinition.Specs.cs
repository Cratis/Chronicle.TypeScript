// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace ProjectionOracle;

/// <summary>
/// Executable reader conformance checks, run by the oracle smoke/check commands without a kernel server.
/// Contract: Chronicle 19.30.0 (dfa5ea4), Contracts/Projections/FromEventPropertyDefinition.cs and Events/EventType.cs.
/// </summary>
internal static class FixtureDefinitionSpecs
{
    public static void Verify()
    {
        VerifyAccepted();
        foreach (var (name, mutate) in RejectedInputs())
        {
            var node = Input();
            mutate(node);
            MustReject(name, node);
        }
        Console.WriteLine("Strict child FromEventProperty reader conformance: OK");
    }

    static void VerifyAccepted()
    {
        foreach (var tombstone in new bool?[] { null, false, true }) VerifyEventProperty(tombstone);
        foreach (var omit in new[] { false, true }) VerifyAbsent(omit);
    }

    static void VerifyEventProperty(bool? tombstone)
    {
        var node = Input();
        var eventType = Property(node)["Event"]!.AsObject();
        if (tombstone is not null) eventType["Tombstone"] = tombstone.Value;
        var wire = FixtureDefinition.Read(node);
        var actual = wire.Children["values"].FromEventProperty!;
        var expected = ("ValueAdded", 2u, tombstone ?? false, "payload.value");
        AssertEqual((actual.Event.Id, actual.Event.Generation, actual.Event.Tombstone, actual.PropertyExpression), expected, "Reader");
        var converted = ProjectionDefinitionBridge.Convert(wire).Children.Single().Value.FromEventProperty!;
        AssertEqual((converted.Event.Id.Value, converted.Event.Generation.Value, converted.Event.Tombstone, converted.PropertyExpression.Value), expected, "Packaged converter");
    }

    static void VerifyAbsent(bool omit)
    {
        var node = Input();
        if (omit) Child(node).Remove("FromEventProperty");
        else Child(node)["FromEventProperty"] = null;
        if (FixtureDefinition.Read(node).Children["values"].FromEventProperty is not null)
        {
            throw new InvalidOperationException("Absent/null child FromEventProperty must remain absent.");
        }
    }

    static void AssertEqual<T>(T actual, T expected, string stage)
    {
        if (!EqualityComparer<T>.Default.Equals(actual, expected))
        {
            throw new InvalidOperationException($"{stage} altered the FromEventProperty wire contract.");
        }
    }

    static IEnumerable<(string Name, Action<JsonObject> Mutate)> RejectedInputs()
    {
        yield return ("unknown child field", node => Child(node)["Unknown"] = true);
        yield return ("unknown property field", node => Property(node)["Unknown"] = true);
        yield return ("unknown event field", node => Property(node)["Event"]!["Unknown"] = true);
        yield return ("property casing", node => { Property(node).Remove("PropertyExpression"); Property(node)["propertyExpression"] = "value"; });
        yield return ("event casing", node => { Property(node).Remove("Event"); Property(node)["event"] = new JsonObject(); });
        yield return ("missing event", node => Property(node).Remove("Event"));
        yield return ("null event", node => Property(node)["Event"] = null);
        yield return ("nonobject event", node => Property(node)["Event"] = "ValueAdded");
        yield return ("missing expression", node => Property(node).Remove("PropertyExpression"));
        yield return ("null expression", node => Property(node)["PropertyExpression"] = null);
        yield return ("numeric expression", node => Property(node)["PropertyExpression"] = 1);
        yield return ("array expression", node => Property(node)["PropertyExpression"] = new JsonArray("value"));
        yield return ("nonobject property", node => Child(node)["FromEventProperty"] = "value");
        yield return ("missing id", node => Property(node)["Event"]!.AsObject().Remove("Id"));
        yield return ("null id", node => Property(node)["Event"]!["Id"] = null);
        yield return ("numeric id", node => Property(node)["Event"]!["Id"] = 1);
        yield return ("missing generation", node => Property(node)["Event"]!.AsObject().Remove("Generation"));
        yield return ("null generation", node => Property(node)["Event"]!["Generation"] = null);
        yield return ("string generation", node => Property(node)["Event"]!["Generation"] = "2");
        yield return ("negative generation", node => Property(node)["Event"]!["Generation"] = -1);
        yield return ("overflow generation", node => Property(node)["Event"]!["Generation"] = 4294967296L);
        yield return ("fractional generation", node => Property(node)["Event"]!["Generation"] = 1.5);
        yield return ("null tombstone", node => Property(node)["Event"]!["Tombstone"] = null);
        yield return ("numeric tombstone", node => Property(node)["Event"]!["Tombstone"] = 0);
        yield return ("string tombstone", node => Property(node)["Event"]!["Tombstone"] = "false");
        yield return ("child All mapping", node => Child(node)["All"]!["Properties"]!["value"] = "value");
        yield return ("unknown child All field", node => Child(node)["All"]!["Unknown"] = true);
        yield return ("nested child", node => Child(node)["Children"]!["nested"] = new JsonObject());
        yield return ("nested projection", node => Child(node)["Nested"]!["nested"] = new JsonObject());
        yield return ("removedWithJoin", node => Child(node)["RemovedWithJoin"] = new JsonArray(new JsonObject()));
        yield return ("root event property", node => node["FromEventProperty"] = Property(node).DeepClone());
        yield return ("unknown root field", node => node["Unknown"] = true);
    }

    static void MustReject(string name, JsonObject node)
    {
        try
        {
            FixtureDefinition.Read(node);
        }
        catch (Exception exception) when (exception is InvalidOperationException or System.Text.Json.JsonException or FormatException or OverflowException)
        {
            return;
        }
        catch (NotSupportedException)
        {
            return;
        }
        throw new InvalidOperationException($"Reader accepted invalid fixture: {name}.");
    }

    static JsonObject Child(JsonObject node) => node["Children"]!["values"]!.AsObject();
    static JsonObject Property(JsonObject node) => Child(node)["FromEventProperty"]!.AsObject();

    static JsonObject Input() => JsonNode.Parse("""
        {
          "EventSequenceId": "00000000-0000-0000-0000-000000000000", "Identifier": "reader-spec",
          "ReadModel": "model", "IsActive": true, "IsRewindable": true, "InitialModelState": "{}",
          "From": [], "Join": [], "RemovedWith": [], "AutoMap": 0, "NoAutoMapProperties": [],
          "Children": {
            "values": {
              "IdentifiedBy": "$eventSourceId", "From": [], "Join": [], "RemovedWith": [],
              "Children": {}, "Nested": {}, "RemovedWithJoin": [], "AutoMap": 0,
              "All": { "Properties": {}, "IncludeChildren": false, "AutoMap": 0 },
              "FromEventProperty": { "Event": { "Id": "ValueAdded", "Generation": 2 }, "PropertyExpression": "payload.value" }
            }
          }
        }
        """)!.AsObject();
}
