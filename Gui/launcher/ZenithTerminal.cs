// ZenithTerminal.exe: the thing a person double-clicks. It starts the window (run_gui.py) with the Python that
// comes with the Terminal, or failing that the one installed on the PC, and shows no console.
//
// Build (the C# compiler that ships with Windows):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /out:ZenithTerminal.exe
//       /win32icon:art\logo\zenith.ico /r:System.Windows.Forms.dll launcher\ZenithTerminal.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

static class ZenithTerminal
{
    const string Name = "The Zenith Terminal";

    [STAThread]
    static int Main(string[] args)
    {
        string here = AppDomain.CurrentDomain.BaseDirectory;
        string script = FirstFile(Path.Combine(here, "run_gui.py"), Path.Combine(here, "Gui", "run_gui.py"));
        if (script == null)
        {
            MessageBox.Show("run_gui.py was not found beside ZenithTerminal.exe. Unzip the whole package again.", Name,
                            MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 2;
        }
        bool bundled;
        string python = FindPython(here, out bundled);
        if (python == null)
        {
            MessageBox.Show("Python was not found.\n\nThe package's own Interpreter folder is missing, and no Python is installed on this PC.",
                            Name, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 3;
        }
        var line = new StringBuilder(Quote(script));
        foreach (string arg in args) line.Append(' ').Append(Quote(arg));
        var start = new ProcessStartInfo(python, line.ToString())
        {
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(script)
        };
        if (bundled)
        {
            // the Terminal's own Python uses its own packages only, whatever Python settings this PC has
            start.EnvironmentVariables.Remove("PYTHONHOME");
            start.EnvironmentVariables.Remove("PYTHONPATH");
            start.EnvironmentVariables["PYTHONNOUSERSITE"] = "1";
        }
        try { Process.Start(start); }
        catch (Exception error)
        {
            MessageBox.Show("The window could not be started.\n\n" + error.Message, Name, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 4;
        }
        return 0;
    }

    static string FirstFile(params string[] candidates)
    {
        foreach (string path in candidates)
            if (File.Exists(path)) return Path.GetFullPath(path);
        return null;
    }

    static string FindPython(string here, out bool bundled)
    {
        const string own = @"Interpreter\pythoncore-3.14-64\pythonw.exe";
        string found = FirstFile(Path.Combine(here, own), Path.Combine(here, "..", own), Path.Combine(here, "..", "..", own));
        bundled = found != null;
        if (found != null) return found;
        foreach (string folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
        {
            string dir = folder.Trim().Trim('"');
            // the Store's "python" there is a stub that opens the Store, not a Python
            if (dir.Length == 0 || dir.IndexOf("WindowsApps", StringComparison.OrdinalIgnoreCase) >= 0) continue;
            try
            {
                string path = Path.Combine(dir, "pythonw.exe");
                if (File.Exists(path)) return path;
            }
            catch (ArgumentException) { }
        }
        return null;
    }

    static string Quote(string text)
    {
        return "\"" + text.Replace("\"", "\\\"") + "\"";
    }
}
