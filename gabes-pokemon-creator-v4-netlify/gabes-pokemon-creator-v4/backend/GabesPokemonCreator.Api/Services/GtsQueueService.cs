using System.Collections.Concurrent;
using System.Security.Cryptography;
using GabesPokemonCreator.Api.Models;

namespace GabesPokemonCreator.Api.Services;

public sealed class GtsQueueService
{
    private readonly ConcurrentDictionary<string, GtsQueueItem> _items = new(StringComparer.OrdinalIgnoreCase);
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public GtsQueueItem Enqueue(PokemonRequest request, AutoLegalizeResult legal)
    {
        if (!legal.Success || !legal.Legal || string.IsNullOrWhiteSpace(legal.DataBase64) || string.IsNullOrWhiteSpace(legal.FileName))
            throw new InvalidOperationException("Only a successfully legalized Pokémon can be queued for GTS delivery.");

        Prune();
        string code;
        do { code = Convert.ToHexString(RandomNumberGenerator.GetBytes(4)); }
        while (_items.ContainsKey(code));

        var now = DateTimeOffset.UtcNow;
        var generation = request.Game is "black" or "white" or "black2" or "white2" ? 5 : 4;
        var item = new GtsQueueItem(code, "waiting", request.Game, generation, request.Species,
            legal.FileName, legal.DataBase64, now, now.Add(Lifetime), null);
        _items[code] = item;
        return item;
    }

    public GtsQueueItem? GetPayload(string code)
    {
        Prune();
        return _items.TryGetValue(Normalize(code), out var item) ? item : null;
    }

    public GtsQueuePublicStatus? GetStatus(string code)
    {
        var item = GetPayload(code);
        return item is null ? null : Public(item);
    }

    public GtsQueuePublicStatus? MarkDelivered(string code)
    {
        var key = Normalize(code);
        if (!_items.TryGetValue(key, out var item)) return null;
        var updated = item with { Status = "delivered", DeliveredAt = DateTimeOffset.UtcNow };
        _items[key] = updated;
        return Public(updated);
    }

    public bool Cancel(string code) => _items.TryRemove(Normalize(code), out _);

    private void Prune()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var pair in _items)
            if (pair.Value.ExpiresAt <= now)
                _items.TryRemove(pair.Key, out _);
    }

    private static string Normalize(string code) => (code ?? "").Trim().Replace("-", "").ToUpperInvariant();
    private static GtsQueuePublicStatus Public(GtsQueueItem x) => new(x.Code, x.Status, x.Game, x.Generation, x.Species, x.FileName, x.CreatedAt, x.ExpiresAt, x.DeliveredAt);
}
