// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;

using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using KernelDefinition = KernelConcepts::Cratis.Chronicle.Concepts.Projections.Definitions.ProjectionDefinition;

namespace ProjectionOracle;

internal static class Program
{
    sealed record Pin(string Version, string Commit, string Contracts, string Hash, string Package);

    static bool RequiresConstraintDescriptor(JsonObject fixture) => new[]
    {
        "constraintDefinitions", "scopeCases", "eventSequenceCases", "fieldConstraintCases", "fieldCombinationCases"
    }.Any(key => fixture[key] is not null);

    static async Task<int> Main(string[] args)
    {
        Environment.SetEnvironmentVariable("TZ", "UTC");
        TimeZoneInfo.ClearCachedData();
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            var (information, versionParts) = InitializeKernel();
            var commandResult = ValidateCommand(args, information, versionParts[0]);
            if (commandResult.HasValue) return commandResult.Value;
            var pin = await ReadPin(versionParts);
            var projectionFiles = args[0] == "--update-events"
                ? []
                : Directory.GetFiles(Path.Combine("Source", "testing", "projections", "fixtures"), "*.json");
            var eventFiles = Directory.GetFiles(Path.Combine("Source", "testing", "fixtures"), "*.json");
            RequiredFixtures.Validate(eventFiles, projectionFiles, args[0] == "--update-events");
            var files = projectionFiles.Concat(eventFiles).OrderBy(name => name, StringComparer.Ordinal).ToArray();
            var drift = 0;
            foreach (var path in files)
            {
                if (await ProcessFixture(path, eventFiles.Contains(path), pin, args[0])) drift++;
            }
            ReportDrift(drift, args[0], information);
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }

    static (string Information, string[] VersionParts) InitializeKernel()
    {
        ProjectionDefinitionBridge.SmokeTest();
        var information = typeof(KernelDefinition).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? throw new InvalidOperationException("Packaged Chronicle engine has no AssemblyInformationalVersion.");
        var versionParts = information.Split('+', 2);
        if (versionParts.Length != 2 || versionParts[1].Length < 7)
        {
            throw new InvalidOperationException($"Unexpected packaged Chronicle version: {information}");
        }
        Console.WriteLine($"Chronicle {versionParts[0]} ({versionParts[1][..7]}) converter signature: OK");
        return (information, versionParts);
    }

    static int? ValidateCommand(string[] args, string information, string version)
    {
        if (args is ["--smoke"]) return 0;
        if (args is not ["--check"] and not ["--update"] and not ["--update-events"] and not ["--probe", _])
        {
            Console.Error.WriteLine("Usage: ProjectionOracle --smoke | --check | --update | --update-events | --probe VERSION (run from the repository root)");
            return 2;
        }
        if (args is ["--probe", var release] && version != release)
        {
            throw new InvalidOperationException($"Probe requested {release} but loaded Chronicle {information}.");
        }
        return null;
    }

    static async Task<Pin> ReadPin(string[] versionParts)
    {
        var package = Path.Combine("node_modules", "@cratis", "chronicle.contracts-oracle");
        var descriptor = Path.Combine(package, "generated", "projections.ts");
        if (!File.Exists(descriptor))
        {
            throw new FileNotFoundException("Install pinned Yarn dependencies (including the @cratis/chronicle.contracts-oracle alias) before checking the contracts descriptor.", descriptor);
        }
        var contractsPackage = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(package, "package.json")))!;
        if (contractsPackage["name"]?.GetValue<string>() != "@cratis/chronicle.contracts")
        {
            throw new InvalidOperationException($"{package} is not the @cratis/chronicle.contracts package.");
        }
        return new Pin(versionParts[0], versionParts[1], contractsPackage["version"]!.GetValue<string>(),
            Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(descriptor))), package);
    }

    static async Task<bool> ProcessFixture(string path, bool isEventFixture, Pin pin, string mode)
    {
        var fixture = JsonNode.Parse(await File.ReadAllTextAsync(path))!.AsObject();
        ValidateFixture(fixture, path, isEventFixture, pin, mode == "--probe");
        Console.WriteLine($"Running {path}");
        var actual = fixture["oracle"]?.GetValue<string>() == "eventScenario"
            ? await EventScenarioOracle.Run(fixture)
            : await OracleRunner.Run(fixture);
        if (mode is "--update" or "--update-events")
        {
            fixture["expected"] = actual;
            await File.WriteAllTextAsync(path, fixture.ToJsonString(new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping }) + "\n");
            return false;
        }
        if (!JsonNode.DeepEquals(fixture["expected"], actual))
        {
            Console.Error.WriteLine($"{path}: drift\nexpected: {fixture["expected"]?.ToJsonString()}\nactual:   {actual.ToJsonString()}");
            return true;
        }
        Console.WriteLine($"{path}: OK");
        return false;
    }

    static void ValidateFixture(JsonObject fixture, string path, bool isEventFixture, Pin pin, bool probe)
    {
        var commit = fixture["chronicle"]?["commit"]?.GetValue<string>();
        var kind = fixture["kind"]?.GetValue<string>();
        if (isEventFixture && fixture["oracle"]?.GetValue<string>() != "eventScenario")
        {
            throw new InvalidOperationException($"{path}: event fixture must use the packaged kernel EventScenario oracle.");
        }
        if (kind is not ("kernelSemantics" or "oracleGuard"))
        {
            throw new InvalidOperationException($"{path}: kind must be 'kernelSemantics' or 'oracleGuard'.");
        }
        ValidateConstraintDescriptor(fixture, path, pin.Package);
        if (!MatchesPin(fixture, pin, probe, commit))
        {
            throw new InvalidOperationException($"{path}: fixture version/hash does not match loaded engine and installed TypeScript contracts.");
        }
    }

    static void ValidateConstraintDescriptor(JsonObject fixture, string path, string package)
    {
        if (RequiresConstraintDescriptor(fixture) && fixture["constraintDescriptorSha256"]?.GetValue<string>() !=
            Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(Path.Combine(package, "generated", "events_constraints.ts")))))
            throw new InvalidOperationException($"{path}: constraint contract descriptor does not match installed TypeScript contracts.");
    }

    static bool MatchesPin(JsonObject fixture, Pin pin, bool probe, string? commit) =>
        fixture["formatVersion"]?.GetValue<int>() == 1 &&
        (probe || MatchesKernel(fixture, pin, commit)) &&
        fixture["tsContracts"]?["version"]?.GetValue<string>() == pin.Contracts &&
        fixture["tsContracts"]?["descriptorSha256"]?.GetValue<string>() == DescriptorHash(fixture, pin);

    static bool MatchesKernel(JsonObject fixture, Pin pin, string? commit) =>
        fixture["chronicle"]?["version"]?.GetValue<string>() == pin.Version &&
        commit is not null && commit.Length >= 7 && pin.Commit.StartsWith(commit, StringComparison.OrdinalIgnoreCase);

    static string DescriptorHash(JsonObject fixture, Pin pin) => fixture["oracle"]?.GetValue<string>() == "eventScenario"
        ? Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(Path.Combine(pin.Package, "generated", "sequences.ts"))))
        : pin.Hash;

    static void ReportDrift(int drift, string mode, string information)
    {
        if (drift == 0) return;
        if (mode == "--probe")
        {
            Console.WriteLine($"::warning::{drift} oracle fixture(s) differ on Chronicle {information}; pin unchanged.");
            return;
        }
        throw new InvalidOperationException($"{drift} oracle fixture(s) drifted; review production semantics before regenerating expectations.");
    }
}
