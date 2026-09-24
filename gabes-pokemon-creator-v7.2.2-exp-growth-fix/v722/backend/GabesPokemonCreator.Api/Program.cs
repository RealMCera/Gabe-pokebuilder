using GabesPokemonCreator.Api.Models;
using GabesPokemonCreator.Api.Services;
using PKHeX.Core;

var builder = WebApplication.CreateBuilder(args);
var port = Environment.GetEnvironmentVariable("PORT") ?? "5088";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddSingleton<PokemonGenerationService>();
builder.Services.AddSingleton<GtsQueueService>();

var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (allowedOrigins.Length == 0)
        p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    else
        p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

var app = builder.Build();
app.UseCors();

app.MapGet("/", () => Results.Ok(new { app = "Gabe's Pokémon Creator API", version = "v8", status = "online" }));
app.MapGet("/api/health", () => new { ok = true, engine = "PKHeX.Core", version = "26.8.26", creator = "v8" });

app.MapGet("/api/games", () => new[] {
    new { id="diamond", name="Pokémon Diamond", generation=4, format="pk4" },
    new { id="pearl", name="Pokémon Pearl", generation=4, format="pk4" },
    new { id="platinum", name="Pokémon Platinum", generation=4, format="pk4" },
    new { id="heartgold", name="Pokémon HeartGold", generation=4, format="pk4" },
    new { id="soulsilver", name="Pokémon SoulSilver", generation=4, format="pk4" },
    new { id="black", name="Pokémon Black", generation=5, format="pk5" },
    new { id="white", name="Pokémon White", generation=5, format="pk5" },
    new { id="black2", name="Pokémon Black 2", generation=5, format="pk5" },
    new { id="white2", name="Pokémon White 2", generation=5, format="pk5" }
});

app.MapGet("/api/data/reference", () =>
{
    var s = GameInfo.Strings;
    return Results.Ok(new {
        species = Indexed(s.specieslist, 649),
        moves = Indexed(s.movelist, 559),
        abilities = Indexed(s.abilitylist, 164),
        items = Indexed(s.itemlist, 700),
    });
});

app.MapGet("/api/data/species/{species:int}", (int species, string game) =>
{
    if (species is < 1 or > 649) return Results.BadRequest();
    bool gen5 = game is "black" or "white" or "black2" or "white2";
    PersonalInfo pi = gen5 ? PersonalTable.B2W2.GetFormEntry((ushort)species, 0) : PersonalTable.HGSS.GetFormEntry((ushort)species, 0);
    var names = GameInfo.Strings.abilitylist;
    var abilities = new List<object>();
    for (int i = 0; i < pi.AbilityCount; i++)
    {
        int id = pi.GetAbilityAtIndex(i);
        if (id > 0 && id < names.Length) abilities.Add(new { id, name = names[id], slot = i });
    }
    return Results.Ok(new { species, abilities });
});

app.MapPost("/api/pokemon/validate", (PokemonRequest request, PokemonGenerationService generator) =>
{
    try { var (valid, report) = generator.Validate(request); return Results.Ok(new { valid, report }); }
    catch (Exception ex) { return Results.BadRequest(new { valid=false, report=ex.Message }); }
});

app.MapPost("/api/pokemon/encounters", (PokemonRequest request, PokemonGenerationService generator) =>
{
    try { return Results.Ok(generator.GetEncounterSuggestions(request)); }
    catch (Exception ex) { return Results.BadRequest(new { error=ex.Message }); }
});

app.MapPost("/api/pokemon/legalize", (PokemonRequest request, PokemonGenerationService generator) =>
{
    try
    {
        var result = generator.AutoLegalize(request);
        return result.Success ? Results.Ok(result) : Results.BadRequest(result);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new AutoLegalizeResult(false, false, ex.Message, [], null, null, null));
    }
});

app.MapPost("/api/pokemon/generate", (PokemonRequest request, PokemonGenerationService generator) =>
{
    try
    {
        var data = generator.Generate(request);
        var ext = request.Game is "black" or "white" or "black2" or "white2" ? "pk5" : "pk4";
        var safe = string.Concat(request.Species.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
        return Results.File(data, "application/octet-stream", $"{safe}.{ext}");
    }
    catch (Exception ex) { return Results.Problem(ex.Message, statusCode:400); }
});

app.MapPost("/api/gts/queue", (PokemonRequest request, PokemonGenerationService generator, GtsQueueService queue) =>
{
    try
    {
        var legal = generator.AutoLegalize(request);
        if (!legal.Success || !legal.Legal)
            return Results.BadRequest(legal);
        var item = queue.Enqueue(request, legal);
        return Results.Ok(new { item.Code, item.Status, item.Game, item.Generation, item.Species, item.FileName, item.CreatedAt, item.ExpiresAt, legal.Adjustments, legal.Encounter });
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
});

app.MapGet("/api/gts/queue/{code}", (string code, GtsQueueService queue) =>
{
    var item = queue.GetPayload(code);
    return item is null ? Results.NotFound(new { error = "Queue code not found or expired." }) : Results.Ok(item);
});

app.MapPost("/api/gts/bridge/next", (HttpRequest http, GtsQueueService queue) =>
{
    var expected = Environment.GetEnvironmentVariable("GTS_BRIDGE_TOKEN");
    if (string.IsNullOrWhiteSpace(expected))
        return Results.Problem("GTS_BRIDGE_TOKEN is not configured on the API.", statusCode: 503);
    if (!http.Headers.TryGetValue("X-GTS-Bridge-Token", out var supplied) || supplied.Count != 1 || supplied[0] != expected)
        return Results.Unauthorized();

    var item = queue.ClaimNextWaiting();
    return item is null ? Results.NoContent() : Results.Ok(item);
});

app.MapPost("/api/gts/bridge/{code}/release", (string code, HttpRequest http, GtsQueueService queue) =>
{
    var expected = Environment.GetEnvironmentVariable("GTS_BRIDGE_TOKEN");
    if (string.IsNullOrWhiteSpace(expected) || !http.Headers.TryGetValue("X-GTS-Bridge-Token", out var supplied) || supplied.Count != 1 || supplied[0] != expected)
        return Results.Unauthorized();
    var item = queue.Release(code);
    return item is null ? Results.NotFound() : Results.Ok(item);
});

app.MapGet("/api/gts/queue/{code}/status", (string code, GtsQueueService queue) =>
{
    var item = queue.GetStatus(code);
    return item is null ? Results.NotFound(new { error = "Queue code not found or expired." }) : Results.Ok(item);
});

app.MapPost("/api/gts/queue/{code}/delivered", (string code, GtsQueueService queue) =>
{
    var item = queue.MarkDelivered(code);
    return item is null ? Results.NotFound(new { error = "Queue code not found or expired." }) : Results.Ok(item);
});

app.MapDelete("/api/gts/queue/{code}", (string code, GtsQueueService queue) =>
    queue.Cancel(code) ? Results.NoContent() : Results.NotFound());

app.Run();

static object[] Indexed(IReadOnlyList<string> values, int max)
{
    var result = new List<object>();
    int end = Math.Min(max, values.Count - 1);
    for (int i = 1; i <= end; i++) if (!string.IsNullOrWhiteSpace(values[i])) result.Add(new { id = i, name = values[i] });
    return result.ToArray();
}
