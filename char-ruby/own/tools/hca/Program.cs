// HcaEncode: WAV (16-bit PCM) -> CRI HCA, the codec every stock BBEE sound uses (docs/cross-effect/research/AUDIO.md).
// Built on VGAudio (Alex Barney, MIT, NuGet "VGAudio"). Used at build time on the player's machine for Ruby's voice and
// sounds, which come from their own BlazBlue Cross Tag Battle install; nothing converted here is ever shipped.
//
// usage: HcaEncode <in.wav> <out.hca> [quality: highest|high|middle|low|lowest (default high)]
//        HcaEncode --batch <folder of .wav> <out folder> [quality]
using VGAudio.Containers.Hca;
using VGAudio.Containers.Wave;
using VGAudio.Codecs.CriHca;

static class Program
{
    static int Main(string[] args)
    {
        try
        {
            if (args.Length >= 3 && args[0] == "--batch")
            {
                var q = Quality(args.Length > 3 ? args[3] : "high");
                Directory.CreateDirectory(args[2]);
                int n = 0;
                foreach (var f in Directory.GetFiles(args[1], "*.wav"))
                {
                    Encode(f, Path.Combine(args[2], Path.GetFileNameWithoutExtension(f) + ".hca"), q); n++;
                }
                Console.WriteLine($"encoded {n} files -> {args[2]}");
                return 0;
            }
            if (args.Length < 2) { Console.Error.WriteLine("usage: HcaEncode <in.wav> <out.hca> [quality] | --batch <in dir> <out dir> [quality]"); return 2; }
            Encode(args[0], args[1], Quality(args.Length > 2 ? args[2] : "high"));
            Console.WriteLine("ok " + args[1]);
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine("HcaEncode: " + e.Message); return 1; }
    }

    static CriHcaQuality Quality(string s) => s.ToLowerInvariant() switch
    {
        "highest" => CriHcaQuality.Highest, "middle" => CriHcaQuality.Middle, "low" => CriHcaQuality.Low,
        "lowest" => CriHcaQuality.Lowest, _ => CriHcaQuality.High,
    };

    static void Encode(string inPath, string outPath, CriHcaQuality q)
    {
        var audio = new WaveReader().Read(File.ReadAllBytes(inPath));
        var cfg = new HcaConfiguration { Quality = q, LimitBitrate = false };
        using var o = File.Create(outPath);
        new HcaWriter().WriteToStream(audio, o, cfg);
    }
}
