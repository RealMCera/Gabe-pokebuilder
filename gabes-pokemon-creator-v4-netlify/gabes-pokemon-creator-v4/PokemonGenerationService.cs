using GabesPokemonCreator.Api.Models;
using PKHeX.Core;

namespace GabesPokemonCreator.Api.Services;

public sealed class PokemonGenerationService
{
    private static readonly Dictionary<string, GameVersion> Versions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["diamond"] = GameVersion.D,
        ["pearl"] = GameVersion.P,
        ["platinum"] = GameVersion.Pt,
        ["heartgold"] = GameVersion.HG,
        ["soulsilver"] = GameVersion.SS,
        ["black"] = GameVersion.B,
        ["white"] = GameVersion.W,
        ["black2"] = GameVersion.B2,
        ["white2"] = GameVersion.W2,
    };

    private static readonly Dictionary<string, Ball> Balls = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Poké Ball"] = Ball.Poke, ["Poke Ball"] = Ball.Poke,
        ["Great Ball"] = Ball.Great, ["Ultra Ball"] = Ball.Ultra, ["Master Ball"] = Ball.Master,
        ["Safari Ball"] = Ball.Safari, ["Net Ball"] = Ball.Net, ["Dive Ball"] = Ball.Dive,
        ["Nest Ball"] = Ball.Nest, ["Repeat Ball"] = Ball.Repeat, ["Timer Ball"] = Ball.Timer,
        ["Luxury Ball"] = Ball.Luxury, ["Premier Ball"] = Ball.Premier, ["Dusk Ball"] = Ball.Dusk,
        ["Heal Ball"] = Ball.Heal, ["Quick Ball"] = Ball.Quick, ["Cherish Ball"] = Ball.Cherish,
        ["Fast Ball"] = Ball.Fast, ["Level Ball"] = Ball.Level, ["Lure Ball"] = Ball.Lure,
        ["Heavy Ball"] = Ball.Heavy, ["Love Ball"] = Ball.Love, ["Friend Ball"] = Ball.Friend,
        ["Moon Ball"] = Ball.Moon, ["Sport Ball"] = Ball.Sport,
    };

    public PKM Build(PokemonRequest request)
    {
        var version = GetVersion(request);
        bool gen5 = IsGen5(version);
        ValidateSpecies(request, gen5);

        PKM pk = gen5 ? new PK5() : new PK4();
        pk.Species = (ushort)request.SpeciesId;
        pk.Version = version;
        ApplyTrainer(pk, request);
        pk.Gender = (byte)Math.Clamp(request.Gender, 0, 2);
        pk.Nature = ParseNature(request.Nature);
        pk.CurrentLevel = (byte)Math.Clamp(request.Level, 1, 100);
        pk.OriginalTrainerFriendship = (byte)Math.Clamp(request.Friendship, 0, 255);
        pk.HeldItem = Math.Max(0, request.ItemId);
        pk.Ball = (byte)GetBall(request.Ball);
        pk.MetLevel = (byte)Math.Clamp(request.MetLevel, 0, 100);
        pk.MetLocation = (ushort)Math.Clamp(request.MetLocation, 0, ushort.MaxValue);
        pk.FatefulEncounter = request.Fateful;
        ApplyDate(pk, request.MetDate);
        ApplyStats(pk, request);
        ApplyMoves(pk, request);
        ApplyPokerus(pk, request.Pokerus);
        ApplyPIDAndAbility(pk, request);
        SetSpeciesName(pk, request.SpeciesId);
        pk.RefreshChecksum();
        return pk;
    }

    public byte[] Generate(PokemonRequest request) => GetStoredBytes(Build(request));

    public (bool Valid, string Report) Validate(PokemonRequest request)
    {
        var pk = Build(request);
        var la = new LegalityAnalysis(pk);
        return (la.Valid, la.Report(true));
    }

    public IReadOnlyList<EncounterSuggestionDto> GetEncounterSuggestions(PokemonRequest request, int max = 30)
    {
        var version = GetVersion(request);
        var sav = CreateTrainerSave(request, version);
        var probe = CreateEncounterProbe(request, version);
        var moves = GetRequestedMoves(request);
        var encounters = EncounterMovesetGenerator.GenerateEncounters(probe, sav, moves, [version]);
        var results = new List<EncounterSuggestionDto>();
        int index = 0;
        foreach (var enc in encounters)
        {
            if (enc.LevelMin > request.Level)
                continue;
            results.Add(ToSuggestion(enc, index++));
            if (results.Count >= max)
                break;
        }
        return results;
    }

    public AutoLegalizeResult AutoLegalize(PokemonRequest request)
    {
        var version = GetVersion(request);
        bool gen5 = IsGen5(version);
        ValidateSpecies(request, gen5);
        var sav = CreateTrainerSave(request, version);
        var probe = CreateEncounterProbe(request, version);
        var moves = GetRequestedMoves(request);
        var encounters = EncounterMovesetGenerator.GenerateEncounters(probe, sav, moves, [version]);

        int encounterIndex = 0;
        string? lastReport = null;
        foreach (var enc in encounters)
        {
            if (enc.LevelMin > request.Level)
                continue;

            var adjustments = new List<string>();
            PKM pk;
            try
            {
                pk = enc.ConvertToPKM(sav);
            }
            catch
            {
                encounterIndex++;
                continue;
            }

            // Evolve the encounter result to the requested species when the core encounter
            // generator says that encounter is a valid origin for the requested Pokémon.
            pk.Species = (ushort)request.SpeciesId;
            pk.CurrentLevel = (byte)Math.Clamp(request.Level, Math.Max(1, (int)enc.LevelMin), 100);
            SetSpeciesName(pk, request.SpeciesId);
            ApplyMoves(pk, request);
            pk.RefreshChecksum();

            var baseAnalysis = new LegalityAnalysis(pk);
            if (!baseAnalysis.Valid)
            {
                lastReport = baseAnalysis.Report(true);
                encounterIndex++;
                continue;
            }

            // Safe/customizable details. Every mutation is accepted only if the Pokémon
            // remains legal; otherwise we revert to the encounter-generated value.
            TryApply(pk, "held item", adjustments,
                () => pk.HeldItem, v => pk.HeldItem = v, Math.Max(0, request.ItemId));
            TryApply(pk, "friendship", adjustments,
                () => pk.OriginalTrainerFriendship, v => pk.OriginalTrainerFriendship = (byte)v,
                Math.Clamp(request.Friendship, 0, 255));

            var oldEVs = GetEVs(pk);
            ApplyEVs(pk, request);
            if (!IsLegal(pk))
            {
                SetEVs(pk, oldEVs);
                adjustments.Add("EV spread was adjusted to preserve legality.");
            }

            // Gen IV PID/IV/nature/gender correlations can force us to keep encounter values.
            var oldIVs = GetIVs(pk);
            ApplyIVs(pk, request);
            if (!IsLegal(pk))
            {
                SetIVs(pk, oldIVs);
                adjustments.Add("Requested IVs conflict with this encounter's PID/IV rules; legal encounter IVs were kept.");
            }

            uint oldPID = pk.PID;
            pk.SetPIDNature(ParseNature(request.Nature));
            if (!IsLegal(pk))
            {
                pk.PID = oldPID;
                adjustments.Add($"Requested {request.Nature} nature could not be applied without breaking encounter legality.");
            }

            byte oldGender = pk.Gender;
            pk.Gender = (byte)Math.Clamp(request.Gender, 0, 2);
            if (!IsLegal(pk))
            {
                pk.Gender = oldGender;
                adjustments.Add("Requested gender is not legal for the selected encounter/species.");
            }

            int oldAbility = pk.Ability;
            int oldAbilityNumber = pk.AbilityNumber;
            int desiredIndex = request.HiddenAbility && gen5 ? 2 : GetAbilityIndex(pk, request.AbilityId);
            if (desiredIndex < 0) desiredIndex = 0;
            pk.RefreshAbility(desiredIndex);
            pk.AbilityNumber = 1 << desiredIndex;
            if (!IsLegal(pk))
            {
                pk.Ability = oldAbility;
                pk.AbilityNumber = oldAbilityNumber;
                adjustments.Add("Requested ability slot was replaced with the legal encounter ability.");
            }

            bool wantedShiny = request.Shiny;
            bool wasShiny = pk.IsShiny;
            uint beforeShinyPID = pk.PID;
            if (wantedShiny && !wasShiny)
                pk.SetShiny();
            else if (!wantedShiny && wasShiny)
                pk.PID ^= 0x10000000;
            if (!IsLegal(pk))
            {
                pk.PID = beforeShinyPID;
                adjustments.Add(wantedShiny
                    ? "This encounter cannot satisfy the requested shiny state; its legal shiny state was kept."
                    : "This encounter has a fixed shiny state, so it was preserved.");
            }

            byte oldBall = pk.Ball;
            pk.Ball = (byte)GetBall(request.Ball);
            if (!IsLegal(pk))
            {
                pk.Ball = oldBall;
                adjustments.Add("Requested Poké Ball is not legal for this encounter; the encounter ball was kept.");
            }

            ApplyPokerus(pk, request.Pokerus);
            ApplyDate(pk, request.MetDate);
            NaturalizeExperience(pk, adjustments);
            pk.RefreshChecksum();
            var final = new LegalityAnalysis(pk);
            if (!final.Valid)
            {
                lastReport = final.Report(true);
                encounterIndex++;
                continue;
            }

            var bytes = GetStoredBytes(pk);
            var ext = gen5 ? "pk5" : "pk4";
            var safe = string.Concat(request.Species.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
            return new AutoLegalizeResult(
                true,
                true,
                final.Report(true),
                adjustments.ToArray(),
                $"{safe}.{ext}",
                Convert.ToBase64String(bytes),
                ToSuggestion(enc, encounterIndex)
            );
        }

        return new AutoLegalizeResult(
            false,
            false,
            lastReport ?? "PKHeX.Core could not find a compatible encounter for this build in the selected game. Try changing the level, moves, ability, shiny setting, or game.",
            [], null, null, null);
    }

    private static SaveFile CreateTrainerSave(PokemonRequest request, GameVersion version)
    {
        var languageValue = (byte)Math.Clamp(request.Language, byte.MinValue, byte.MaxValue);
        var language = Enum.IsDefined(typeof(LanguageID), languageValue)
            ? (LanguageID)languageValue
            : LanguageID.English;
        var sav = BlankSaveFile.Get(version, string.IsNullOrWhiteSpace(request.Ot) ? "Gabe" : request.Ot.Trim(), language);
        sav.TID16 = (ushort)Math.Clamp(request.Tid, 0, ushort.MaxValue);
        sav.SID16 = (ushort)Math.Clamp(request.Sid, 0, ushort.MaxValue);
        sav.Gender = (byte)Math.Clamp(request.OtGender, 0, 1);
        return sav;
    }

    private static PKM CreateEncounterProbe(PokemonRequest request, GameVersion version)
    {
        PKM pk = IsGen5(version) ? new PK5() : new PK4();
        pk.Species = (ushort)request.SpeciesId;
        pk.Form = 0;
        pk.Version = version;
        pk.CurrentLevel = (byte)Math.Clamp(request.Level, 1, 100);
        ApplyMoves(pk, request);
        return pk;
    }

    private static ReadOnlyMemory<ushort> GetRequestedMoves(PokemonRequest request)
    {
        var ids = request.Moves.Where(z => z.Id > 0).Take(4).Select(z => (ushort)z.Id).ToArray();
        return new ReadOnlyMemory<ushort>(ids);
    }

    private static EncounterSuggestionDto ToSuggestion(IEncounterable enc, int index) => new(
        index,
        enc.GetType().Name,
        enc.Version.ToString(),
        enc.Generation,
        enc.Species,
        enc.Form,
        enc.LevelMin,
        enc.LevelMax
    );

    private static bool IsLegal(PKM pk)
    {
        pk.RefreshChecksum();
        return new LegalityAnalysis(pk).Valid;
    }

    private static void TryApply(PKM pk, string label, List<string> adjustments, Func<int> getter, Action<int> setter, int desired)
    {
        int old = getter();
        setter(desired);
        if (IsLegal(pk))
            return;
        setter(old);
        adjustments.Add($"Requested {label} was adjusted to preserve legality.");
    }

    private static (int hp, int atk, int def, int spa, int spd, int spe) GetIVs(PKM pk) =>
        (pk.IV_HP, pk.IV_ATK, pk.IV_DEF, pk.IV_SPA, pk.IV_SPD, pk.IV_SPE);
    private static void SetIVs(PKM pk, (int hp, int atk, int def, int spa, int spd, int spe) v)
    {
        pk.IV_HP=v.hp; pk.IV_ATK=v.atk; pk.IV_DEF=v.def; pk.IV_SPA=v.spa; pk.IV_SPD=v.spd; pk.IV_SPE=v.spe;
    }
    private static (int hp, int atk, int def, int spa, int spd, int spe) GetEVs(PKM pk) =>
        (pk.EV_HP, pk.EV_ATK, pk.EV_DEF, pk.EV_SPA, pk.EV_SPD, pk.EV_SPE);
    private static void SetEVs(PKM pk, (int hp, int atk, int def, int spa, int spd, int spe) v)
    {
        pk.EV_HP=v.hp; pk.EV_ATK=v.atk; pk.EV_DEF=v.def; pk.EV_SPA=v.spa; pk.EV_SPD=v.spd; pk.EV_SPE=v.spe;
    }


    private static void NaturalizeExperience(PKM pk, List<string> adjustments)
    {
        // CurrentLevel's setter places EXP exactly at the threshold for that level.
        // For a Pokémon that has gained levels since capture, that can look artificial.
        // Move it partway toward the next level, but keep the change only if PKHeX
        // still considers the encounter legal.
        int level = pk.CurrentLevel;
        if (level >= 100 || level <= pk.MetLevel)
            return;

        uint minimum = Experience.GetEXP((byte)level, pk.PersonalInfo.EXPGrowth);
        if (pk.EXP != minimum)
            return;

        uint next = Experience.GetEXP((byte)(level + 1), pk.PersonalInfo.EXPGrowth);
        if (next <= minimum + 1)
            return;

        uint old = pk.EXP;
        uint span = next - minimum;
        uint progress = Math.Max(1u, span / 3u);
        pk.EXP = minimum + progress;

        if (IsLegal(pk))
            return;

        pk.EXP = old;
        adjustments.Add("Experience was kept at the encounter-generated value to preserve legality.");
    }

    private static byte[] GetStoredBytes(PKM pk)
    {
        pk.RefreshChecksum();
        var result = new byte[pk.SIZE_STORED];
        pk.WriteEncryptedDataStored(result);
        return result;
    }

    private static void ApplyTrainer(PKM pk, PokemonRequest request)
    {
        pk.Language = Math.Clamp(request.Language, 1, 8);
        pk.TID16 = (ushort)Math.Clamp(request.Tid, 0, ushort.MaxValue);
        pk.SID16 = (ushort)Math.Clamp(request.Sid, 0, ushort.MaxValue);
        pk.OriginalTrainerName = string.IsNullOrWhiteSpace(request.Ot) ? "Gabe" : request.Ot.Trim();
        pk.OriginalTrainerGender = (byte)Math.Clamp(request.OtGender, 0, 1);
    }

    private static void ValidateSpecies(PokemonRequest request, bool gen5)
    {
        if (request.SpeciesId is <= 0 or > 649)
            throw new ArgumentException("Species ID must be between 1 and 649 for the DS games.");
        if (!gen5 && request.SpeciesId > 493)
            throw new ArgumentException("Generation IV only supports National Dex species 1-493.");
    }

    private static GameVersion GetVersion(PokemonRequest request) =>
        Versions.TryGetValue(request.Game, out var version) ? version : throw new ArgumentException($"Unsupported game: {request.Game}");
    private static bool IsGen5(GameVersion version) => version is GameVersion.B or GameVersion.W or GameVersion.B2 or GameVersion.W2;

    private static void ApplyPIDAndAbility(PKM pk, PokemonRequest request)
    {
        pk.SetPIDNature(pk.Nature);
        if (request.Shiny)
            pk.SetShiny();
        int desiredIndex = request.HiddenAbility && pk.Format == 5 ? 2 : GetAbilityIndex(pk, request.AbilityId);
        if (desiredIndex < 0) desiredIndex = 0;
        pk.RefreshAbility(desiredIndex);
        pk.AbilityNumber = 1 << desiredIndex;
    }

    private static int GetAbilityIndex(PKM pk, int abilityId)
    {
        if (abilityId <= 0) return 0;
        var pi = pk.PersonalInfo;
        for (int i = 0; i < pi.AbilityCount; i++)
            if (pi.GetAbilityAtIndex(i) == abilityId)
                return i;
        return 0;
    }

    private static void ApplyMoves(PKM pk, PokemonRequest request)
    {
        Span<ushort> moves = stackalloc ushort[4];
        for (int i = 0; i < Math.Min(4, request.Moves.Length); i++)
            moves[i] = (ushort)Math.Clamp(request.Moves[i].Id, 0, ushort.MaxValue);
        pk.SetMoves(moves);
        pk.HealPP();
    }

    private static void ApplyStats(PKM pk, PokemonRequest request)
    {
        ApplyIVs(pk, request);
        ApplyEVs(pk, request);
    }
    private static void ApplyIVs(PKM pk, PokemonRequest request)
    {
        pk.IV_HP = IV(request, "HP"); pk.IV_ATK = IV(request, "Attack"); pk.IV_DEF = IV(request, "Defense");
        pk.IV_SPA = IV(request, "Sp. Atk"); pk.IV_SPD = IV(request, "Sp. Def"); pk.IV_SPE = IV(request, "Speed");
    }
    private static void ApplyEVs(PKM pk, PokemonRequest request)
    {
        var vals = new[] { EV(request,"HP"), EV(request,"Attack"), EV(request,"Defense"), EV(request,"Sp. Atk"), EV(request,"Sp. Def"), EV(request,"Speed") };
        int total = vals.Sum();
        if (total > 510)
        {
            // Scale the request down deterministically rather than generating an illegal spread.
            double scale = 510d / total;
            for (int i = 0; i < vals.Length; i++) vals[i] = (int)Math.Floor(vals[i] * scale);
        }
        pk.EV_HP=vals[0]; pk.EV_ATK=vals[1]; pk.EV_DEF=vals[2]; pk.EV_SPA=vals[3]; pk.EV_SPD=vals[4]; pk.EV_SPE=vals[5];
    }

    private static int IV(PokemonRequest r, string key) => Math.Clamp(r.Ivs.GetValueOrDefault(key, 31), 0, 31);
    private static int EV(PokemonRequest r, string key) => Math.Clamp(r.Evs.GetValueOrDefault(key, 0), 0, 255);

    private static void ApplyPokerus(PKM pk, int state)
    {
        if (state <= 0) { pk.PokerusStrain = 0; pk.PokerusDays = 0; return; }
        pk.PokerusStrain = 1;
        pk.PokerusDays = state == 1 ? 3 : 0;
    }

    private static void ApplyDate(PKM pk, string value)
    {
        if (!DateOnly.TryParse(value, out var date)) date = DateOnly.FromDateTime(DateTime.Today);
        pk.MetYear = (byte)Math.Clamp(date.Year - 2000, 0, 255);
        pk.MetMonth = (byte)date.Month;
        pk.MetDay = (byte)date.Day;
    }

    private static void SetSpeciesName(PKM pk, int species)
    {
        // PKHeX needs the generation/language-specific default nickname bytes,
        // not the modern UI species string. ClearNickname() writes the exact
        // species name and trash bytes expected for this PKM format.
        pk.Species = (ushort)species;
        pk.ClearNickname();
    }

    private static Nature ParseNature(string value) => Enum.TryParse<Nature>(value, true, out var nature) ? nature : Nature.Hardy;
    private static Ball GetBall(string value) => Balls.GetValueOrDefault(value, Ball.Poke);
}
