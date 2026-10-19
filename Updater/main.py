"""Mod Updater for BlazBlue Entropy Effect Mod Loader.

Reads repositories.txt, checks local mod versions in Launcher/mods/<mod-name>,
compares with remote versions, and performs safe, atomic updates with backup
creation and automatic rollback on failure.

Channels (Updater/channel.txt, or --channel):
    "stable" (the default) reads the lists at the root of the Update Center and
    never replaces a mod whose local version is newer than the remote one.
    Any other channel reads the lists in the Update Center's <channel>/ folder.
    A channel marked "exact" makes every listed component match the channel
    exactly, older or newer, and can install listed mods that are not present.

Downloads print "[*] Downloaded <done>/<total> files, ..." progress lines. While
the file Updater/_work/pause exists, downloads wait before their next file. Files
downloaded by a run that was killed or lost the network are kept in
Updater/_work/<component>/staging and not fetched again by the next run.

A mod folder holding a mod.json but no version.txt (added from a zip) is adopted
with mod.json's version and updated like any installed mod. After a mod is
updated, the files it replaced are kept in Updater/rollback/<mod>/ so
--rollback NAME can put the previous version back; a rolled-back mod is named in
Updater/held.txt and not updated until the name is taken out of that file.

Options beyond the folders and lists: --channel, --exact, --install-new,
--token-file, --check, --no-pin, --rollback NAME, --report PATH.

Exit codes: 0 every check ran (updated or already current), 1 at least one
component failed, 2 nothing could be reached (offline), 5 stopped by the user
(Updater/_work/stop). Each run writes Updater/last_run.json (or the --report path).
"""

import argparse
import concurrent.futures
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

try:
    from packaging import version as pkg_version
except ImportError:
    pkg_version = None

GUI_REPOSITORY_URL = "https://raw.githubusercontent.com/KittySkin/Zenith-Update-Center/refs/heads/main/gui_repositories.txt"
LAUNCHER_REPOSITORY_URL = "https://raw.githubusercontent.com/KittySkin/Zenith-Update-Center/refs/heads/main/launcher_repositories.txt"
REPOSITORIES_URL = "https://raw.githubusercontent.com/KittySkin/Zenith-Update-Center/refs/heads/main/repositories.txt"
UPDATER_REPOSITORY_URL = "https://raw.githubusercontent.com/KittySkin/Zenith-Update-Center/refs/heads/main/updater_repositories.txt"
DEFAULT_GUI_REPOSITORIES_FILENAME = "gui_repositories.txt"
DEFAULT_LAUNCHER_REPOSITORIES_FILENAME = "launcher_repositories.txt"
DEFAULT_MODS_REPOSITORIES_FILENAME = "repositories.txt"
DEFAULT_UPDATER_REPOSITORIES_FILENAME = "updater_repositories.txt"
DECLINED_FILENAME = "declined.txt"  # mods the player deleted: install-new does not bring them back
HELD_FILENAME = "held.txt"  # mods the player rolled back: not updated until the window takes the name out
PAUSE_FILENAME = "pause"    # in the work folder: downloads wait while it exists
PAUSE_POLL = 0.5            # seconds between looks at the pause file
PROGRESS_EVERY = 0.5        # at most one progress line per this many seconds
MB = 1048576
USER_AGENT = "BBEEML-Updater/1.0"
REQUEST_TIMEOUT = 30
DEFAULT_CHANNEL = "stable"
CHANNEL_FILENAME = "channel.txt"
DOWNLOAD_WORKERS = 8
GITHUB_HOSTS = ("github.com", "api.github.com", "raw.githubusercontent.com", "codeload.github.com")
TOKEN_ENV = "ZENITH_UPDATER_TOKEN"  # a token from the environment, when no token file is given


class RunSettings:
    """What one run of the updater works with: the channel and its rules.

    Functions called on their own (as the tests do) see the defaults: the stable
    rules, branch addresses, no token, no work folder.
    """

    def __init__(self):
        self.channel = DEFAULT_CHANNEL
        self.exact = False          # match the channel exactly, older or newer
        self.install_new = False    # also add listed mods that are missing (any channel)
        self.declined: Set[str] = set()  # mods the player deleted (Updater/declined.txt): not added again
        self.held: Set[str] = set()      # mods the player rolled back (Updater/held.txt): not updated
        self.rollback_dir: Optional[Path] = None  # where the previous version of each updated mod is kept
        self.pin_commits = False    # read GitHub files at the branch's current commit (no CDN delay)
        self.token: Optional[str] = None  # for a private source
        self.work_dir: Optional[Path] = None   # backups and staging that survive a killed run
        self.state_dir: Optional[Path] = None  # the manifest each component was last updated to
        self.check_only = False     # report what would change, change nothing
        self.lists: Optional[str] = None  # where the channel's three lists are (channel.txt 'lists:')
        self.report: Dict[str, dict] = {}


SETTINGS = RunSettings()
_PINNED_REFS: Dict[Tuple[str, str, str], Optional[str]] = {}
_PIN_LOCK = threading.Lock()


def read_channel_file(path: Path) -> Dict[str, str]:
    """Reads Updater/channel.txt: 'key: value' lines (channel, exact, install-new, token-file, lists).

    A file holding only one word is read as the channel name.
    """
    out: Dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip().lower()] = v.strip()
        elif "channel" not in out:
            out["channel"] = line
    return out


def channel_url(url: str, channel: str) -> str:
    """The address of a list for a channel: stable keeps the root, others read <channel>/<list>."""
    if not channel or channel == DEFAULT_CHANNEL:
        return url
    head, _, name = url.rpartition("/")
    return f"{head}/{channel}/{name}"


def list_url(url: str) -> str:
    """The address the run reads a list from: channel.txt's 'lists:' folder when it names one
    (a channel kept in its own repository, private or not), else channel_url()."""
    if SETTINGS.lists:
        return f"{SETTINGS.lists.rstrip('/')}/{url.rpartition('/')[2]}"
    return channel_url(url, SETTINGS.channel)


def is_yes(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("1", "yes", "true", "on")


def parse_version_tuple(ver_str: str) -> tuple:
    """Parses a version string into a comparable tuple of integers/strings.

    Used as fallback when packaging is not available or for non-standard formats.
    """
    clean_ver = ver_str.strip().lstrip("vV")
    tokens = re.findall(r"\d+|\D+", clean_ver)
    parsed = []
    for token in tokens:
        if token.isdigit():
            parsed.append((0, int(token)))
        else:
            cleaned = token.strip(".-_+")
            if cleaned:
                parsed.append((1, cleaned))
    return tuple(parsed)


def is_newer_version(remote_ver: str, local_ver: str) -> bool:
    """Returns True if remote_ver is strictly newer/higher than local_ver."""
    r_clean = remote_ver.strip()
    l_clean = local_ver.strip()

    if not r_clean:
        return False
    if not l_clean:
        return True
    if r_clean == l_clean:
        return False

    if pkg_version is not None:
        try:
            return pkg_version.parse(r_clean) > pkg_version.parse(l_clean)
        except Exception:
            pass

    return parse_version_tuple(r_clean) > parse_version_tuple(l_clean)


def parse_repositories_file(file_path: Path, default_key: Optional[str] = None) -> Dict[str, str]:
    """Parses repositories.txt / launcher_repositories.txt / Gui_repositories.txt.

    Expected format per line:
    1) mod-name: repository-remote-location
    2) repository-remote-location (uses default_key or last path segment as the key)
    """
    repositories = {}
    if not file_path.exists():
        print(f"[!] Repositories file not found at: {file_path}")
        return repositories

    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            # Check if line is a direct URL or path (e.g. https://..., file://..., or relative/abs path)
            # without a '<key>:' prefix
            is_url = (
                line.startswith("http://")
                or line.startswith("https://")
                or line.startswith("file://")
            )

            if is_url:
                key = default_key
                if not key:
                    clean_line = line.rstrip("/")
                    key = clean_line.split("/")[-1] or f"repo_{line_num}"
                repositories[key] = line
            elif ":" in line:
                parts = line.split(":", 1)
                mod_name = parts[0].strip()
                repo_url = parts[1].strip()
                if mod_name and repo_url:
                    repositories[mod_name] = repo_url
                else:
                    print(f"[!] Skipping invalid line {line_num} in {file_path}: {line}")
            else:
                print(f"[!] Skipping invalid line {line_num} in {file_path}: {line}")

    return repositories


def fetch_remote_repositories_content(url: str = REPOSITORIES_URL) -> Optional[str]:
    """Fetches the content of the remote repositories.txt from url."""
    if not url:
        return None
    url = url.strip()

    # Case 1: Local file URL or local path
    if url.startswith("file://") or os.path.exists(url):
        local_path_str = url[7:] if url.startswith("file://") else url
        local_path = Path(local_path_str)
        if local_path.is_file():
            return local_path.read_text(encoding="utf-8")
        elif (local_path / "repositories.txt").is_file():
            return (local_path / "repositories.txt").read_text(encoding="utf-8")
        return None

    # Case 2: HTTP / HTTPS URL
    try:
        content_bytes = http_get(pinned_raw_url(url))
        return content_bytes.decode("utf-8")
    except Exception as e:
        print(f"[!] Warning: Could not fetch remote repositories from {url}: {e}")
        return None


def sync_repositories_file(repositories_file: Path, remote_url: str = REPOSITORIES_URL) -> bool:
    """Checks local repositories.txt against remote_url and updates it if out of date.

    Returns True if the file was updated, False if already up to date or couldn't be fetched.
    """
    print(f"[*] Checking repositories configuration against remote: {remote_url}")
    remote_content = fetch_remote_repositories_content(remote_url)
    if remote_content is None:
        print("[!] Remote repositories could not be retrieved. Proceeding with existing local file.")
        return False

    local_content = ""
    if repositories_file.exists():
        try:
            local_content = repositories_file.read_text(encoding="utf-8")
        except Exception as e:
            print(f"[!] Warning: Could not read local repositories file {repositories_file}: {e}")

    norm_local = local_content.replace("\r\n", "\n").strip()
    norm_remote = remote_content.replace("\r\n", "\n").strip()

    if not repositories_file.exists() or norm_local != norm_remote:
        print(f"[+] Local repositories.txt is out of date or missing. Updating to match remote...")
        repositories_file.parent.mkdir(parents=True, exist_ok=True)
        repositories_file.write_text(remote_content, encoding="utf-8")
        print(f"[+] repositories.txt updated successfully.")
        mark_list_channel(repositories_file, remote_url)
        return True

    print(f"[=] Local repositories.txt is up to date with remote.")
    mark_list_channel(repositories_file, remote_url)
    return False


def _list_channel_marker(repositories_file: Path) -> Path:
    return repositories_file.with_name(repositories_file.name + ".channel")


def list_source(url: Optional[str]) -> str:
    """The folder a list is read from (its address without the file name)."""
    url = (url or "").strip()
    return url[:max(url.rfind("/"), url.rfind(chr(92)))]


UPDATE_CENTER = list_source(REPOSITORIES_URL)


def mark_list_channel(repositories_file: Path, remote_url: Optional[str] = None) -> None:
    """Notes which channel, and which folder, a synced list came from (kept beside it as <list>.channel)."""
    marker = _list_channel_marker(repositories_file)
    source = list_source(remote_url)
    if SETTINGS.channel == DEFAULT_CHANNEL and source in ("", UPDATE_CENTER) and not marker.exists():
        return
    try:
        marker.write_text(SETTINGS.channel + "\n" + source + "\n", encoding="utf-8")
    except Exception as e:
        print(f"[!] Warning: could not note the channel of {repositories_file}: {e}")


def _list_marker_lines(repositories_file: Path) -> List[str]:
    marker = _list_channel_marker(repositories_file)
    if marker.is_file():
        return marker.read_text(encoding="utf-8").splitlines()
    return []


def list_channel(repositories_file: Path) -> str:
    """The channel a local list was last synced from (stable when never noted)."""
    lines = _list_marker_lines(repositories_file)
    return (lines[0].strip().lower() if lines else "") or DEFAULT_CHANNEL


def list_is_from(repositories_file: Path, remote_url: str) -> bool:
    """The local list was last synced from this run's channel and from the same folder. A list that came with the
    package (never synced, or noted before folders were) counts as the Update Center's."""
    lines = _list_marker_lines(repositories_file)
    source = lines[1].strip() if len(lines) > 1 else UPDATE_CENTER
    return list_channel(repositories_file) == SETTINGS.channel and source == list_source(remote_url)


class GitHubRepoLocation:
    """Handles GitHub repository and folder URLs."""

    GITHUB_TREE_PATTERN = re.compile(
        r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/tree/(?P<branch>[^/]+)(?:/(?P<path>.+))?/?$",
        re.IGNORECASE,
    )
    GITHUB_ROOT_PATTERN = re.compile(
        r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/?$",
        re.IGNORECASE,
    )
    GITHUB_RAW_PATTERN = re.compile(
        r"^https?://raw\.githubusercontent\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/(?P<branch>[^/]+)(?:/(?P<path>.+))?/?$",
        re.IGNORECASE,
    )

    def __init__(self, owner: str, repo: str, branch: str, subpath: str = ""):
        self.owner = owner
        self.repo = repo
        self.branch = branch
        self.subpath = subpath.strip("/")
        self.pinned_ref: Optional[str] = None
        if SETTINGS.pin_commits:
            self.pinned_ref = resolve_commit(owner, repo, branch)

    @property
    def ref(self) -> str:
        """The branch, or the commit it points at when the run pins commits."""
        return self.pinned_ref or self.branch

    @classmethod
    def parse(cls, url: str) -> Optional["GitHubRepoLocation"]:
        url = url.strip()
        m_tree = cls.GITHUB_TREE_PATTERN.match(url)
        if m_tree:
            return cls(
                owner=m_tree.group("owner"),
                repo=m_tree.group("repo"),
                branch=m_tree.group("branch"),
                subpath=m_tree.group("path") or "",
            )

        m_raw = cls.GITHUB_RAW_PATTERN.match(url)
        if m_raw:
            return cls(
                owner=m_raw.group("owner"),
                repo=m_raw.group("repo"),
                branch=m_raw.group("branch"),
                subpath=m_raw.group("path") or "",
            )

        m_root = cls.GITHUB_ROOT_PATTERN.match(url)
        if m_root:
            return cls(
                owner=m_root.group("owner"),
                repo=m_root.group("repo"),
                branch="main",
                subpath="",
            )

        return None

    def get_version_url(self) -> str:
        """Returns the raw URL for version.txt."""
        path_part = f"{self.subpath}/version.txt" if self.subpath else "version.txt"
        return f"https://raw.githubusercontent.com/{self.owner}/{self.repo}/{self.ref}/{path_part}"

    def get_files_url(self) -> str:
        """Returns the raw URL for files.txt."""
        path_part = f"{self.subpath}/files.txt" if self.subpath else "files.txt"
        return f"https://raw.githubusercontent.com/{self.owner}/{self.repo}/{self.ref}/{path_part}"

    def get_file_url(self, rel_path: str) -> str:
        """Returns the raw URL for a specific relative file path."""
        clean_rel = rel_path.strip().replace("\\", "/").lstrip("/")
        path_part = f"{self.subpath}/{clean_rel}" if self.subpath else clean_rel
        return f"https://raw.githubusercontent.com/{self.owner}/{self.repo}/{self.ref}/{path_part}"

    def get_archive_url(self) -> str:
        """Returns the zip archive URL for downloading the repository branch."""
        if self.pinned_ref:
            return f"https://github.com/{self.owner}/{self.repo}/archive/{self.pinned_ref}.zip"
        return f"https://github.com/{self.owner}/{self.repo}/archive/refs/heads/{self.branch}.zip"


def http_get(url: str, timeout: int = REQUEST_TIMEOUT, headers: Optional[Dict[str, str]] = None) -> bytes:
    """Performs an HTTP GET request with standard user-agent header (and the run's token on GitHub)."""
    all_headers = {"User-Agent": USER_AGENT}
    host = urllib.parse.urlsplit(url).hostname or ""
    if SETTINGS.token and host in GITHUB_HOSTS:
        all_headers["Authorization"] = f"token {SETTINGS.token}"
    if headers:
        all_headers.update(headers)
    req = urllib.request.Request(url, headers=all_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            _NOT_FOUND.add(url)
        raise


# Addresses the server answered 404 for in this run: the channel does not carry that file
# (not published yet), which is not the same as the server being out of reach.
_NOT_FOUND: Set[str] = set()


def not_published(url: str) -> bool:
    return url in _NOT_FOUND


def resolve_commit(owner: str, repo: str, branch: str) -> Optional[str]:
    """The commit a branch points at now, asked once per run (GitHub API, one request per repository).

    raw.githubusercontent.com keeps a branch's files cached for about five minutes; a
    commit address is never stale, so a push is seen at once. None when it cannot be
    asked (offline, rate limit): the branch address is used then.
    """
    key = (owner.lower(), repo.lower(), branch)
    with _PIN_LOCK:
        if key in _PINNED_REFS:
            return _PINNED_REFS[key]
    sha = None
    try:
        data = http_get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{urllib.parse.quote(branch, safe='')}",
            timeout=10,
            headers={"Accept": "application/vnd.github.sha"},
        ).decode("utf-8").strip()
        if re.fullmatch(r"[0-9a-f]{40}", data):
            sha = data
    except urllib.error.HTTPError as e:
        if e.code not in (404, 422):  # 404/422: no such branch (the "master" fallback asks for one)
            print(f"[-] Could not read the current commit of {owner}/{repo}@{branch} ({e}); reading the branch.")
    except Exception as e:
        print(f"[-] Could not read the current commit of {owner}/{repo}@{branch} ({e}); reading the branch.")
    with _PIN_LOCK:
        _PINNED_REFS[key] = sha
    return sha


def pinned_raw_url(url: str) -> str:
    """A raw.githubusercontent.com branch address rewritten to the branch's current commit."""
    if not SETTINGS.pin_commits:
        return url
    m = re.match(
        r"^(https?://raw\.githubusercontent\.com/)([^/]+)/([^/]+)/(?:refs/heads/)?([^/]+)/(.+)$", url.strip(), re.IGNORECASE
    )
    if not m:
        return url
    sha = resolve_commit(m.group(2), m.group(3), m.group(4))
    return f"{m.group(1)}{m.group(2)}/{m.group(3)}/{sha}/{m.group(5)}" if sha else url


def compute_sha256(file_path: Path) -> str:
    """Computes the SHA256 hexadecimal digest of a local file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def compute_sha256_bytes(data: bytes) -> str:
    """Computes the SHA256 hexadecimal digest of bytes in memory."""
    return hashlib.sha256(data).hexdigest().lower()


SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def is_safe_rel_path(rel_path: str) -> bool:
    """A manifest path stays inside its folder: relative, no drive or UNC, no '..' part."""
    p = rel_path.replace("\\", "/")
    if not p or p.startswith("/") or re.match(r"^[A-Za-z]:", p) or "\x00" in p:
        return False
    return all(part not in ("..", "") for part in p.split("/"))


def is_inside(child: Path, parent: Path) -> bool:
    """True when child resolves to a path inside parent."""
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except (ValueError, OSError):
        return False


def drop_unsafe_paths(manifest: Dict[str, str]) -> Dict[str, str]:
    """Removes manifest entries that would reach outside the component's folder."""
    out = {}
    for rel_path, sha in manifest.items():
        if is_safe_rel_path(rel_path):
            out[rel_path] = sha
        else:
            print(f"[!] Ignoring '{rel_path}' in files.txt: it points outside the folder.")
    return out


def parse_files_manifest(content: str) -> Dict[str, str]:
    """Parses files.txt content into a mapping of normalized relative file paths to sha256 hashes.

    Supports formats:
    - '<sha256>  <filepath>' or '<sha256> *<filepath>' (sha256sum format)
    - '<filepath>: <sha256>'
    - '<filepath> <sha256>'
    - '<sha256> <filepath>'
    """
    manifest = {}
    if not content:
        return manifest

    # Check for possible JSON manifest
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        try:
            import json
            data = json.loads(stripped)
            if isinstance(data, dict):
                for k, v in data.items():
                    norm_k = k.strip().replace("\\", "/").lstrip("/")
                    manifest[norm_k] = str(v).strip().lower()
                return drop_unsafe_paths(manifest)
        except Exception:
            pass

    for line_num, line in enumerate(content.splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        # Format 1: filepath: sha256 or sha256: filepath
        if ":" in line:
            parts = line.split(":", 1)
            p1, p2 = parts[0].strip(), parts[1].strip()
            if re.fullmatch(r"[0-9a-fA-F]{64}", p2):
                norm_path = p1.replace("\\", "/").lstrip("/")
                manifest[norm_path] = p2.lower()
                continue
            elif re.fullmatch(r"[0-9a-fA-F]{64}", p1):
                norm_path = p2.replace("\\", "/").lstrip("/")
                manifest[norm_path] = p1.lower()
                continue

        # Format 2 & 3: whitespace separated (sha256 first or filepath first)
        parts = line.split(None, 1)
        if len(parts) == 2:
            p1, p2 = parts[0].strip(), parts[1].strip().lstrip("*").strip()
            if re.fullmatch(r"[0-9a-fA-F]{64}", p1):
                norm_path = p2.replace("\\", "/").lstrip("/")
                manifest[norm_path] = p1.lower()
                continue
            p_split = line.rsplit(None, 1)
            if len(p_split) == 2 and re.fullmatch(r"[0-9a-fA-F]{64}", p_split[1].strip()):
                norm_path = p_split[0].strip().replace("\\", "/").lstrip("/")
                manifest[norm_path] = p_split[1].strip().lower()
                continue

        # Fallback: line might contain 64-char hex token
        hex_match = re.search(r"\b([0-9a-fA-F]{64})\b", line)
        if hex_match:
            sha = hex_match.group(1).lower()
            file_part = line.replace(hex_match.group(0), "").strip().strip(":*").strip()
            if file_part:
                norm_path = file_part.replace("\\", "/").lstrip("/")
                manifest[norm_path] = sha
                continue

        # If only a path is specified (no sha found)
        norm_path = line.replace("\\", "/").lstrip("/")
        manifest[norm_path] = ""

    return drop_unsafe_paths(manifest)


def fetch_remote_files_manifest(remote_location: str) -> Optional[Dict[str, str] | None]:
    """Retrieves and parses the remote files.txt from the remote location."""
    remote_location = remote_location.strip()

    # Case 1: Local file/directory path
    if remote_location.startswith("file://") or os.path.exists(remote_location):
        local_path_str = remote_location[7:] if remote_location.startswith("file://") else remote_location
        local_path = Path(local_path_str)
        files_file = local_path / "files.txt" if local_path.is_dir() else local_path.parent / "files.txt"
        if files_file.exists():
            return parse_files_manifest(files_file.read_text(encoding="utf-8"))
        print(f"[!] Local files.txt not found at {files_file}")
        return None

    # Case 2: GitHub repository URL
    gh = GitHubRepoLocation.parse(remote_location)
    if gh:
        files_url = gh.get_files_url()
        try:
            content = http_get(files_url).decode("utf-8")
            return parse_files_manifest(content)
        except urllib.error.HTTPError as e:
            if e.code == 404 and gh.branch == "main":
                try:
                    fallback_gh = GitHubRepoLocation(gh.owner, gh.repo, "master", gh.subpath)
                    content = http_get(fallback_gh.get_files_url()).decode("utf-8")
                    return parse_files_manifest(content)
                except Exception:
                    pass
            print(f"[!] Failed to fetch files.txt from {files_url}: HTTP {e.code}")
            return None
        except Exception as e:
            print(f"[!] Error fetching remote files.txt from {files_url}: {e}")
            return None

    # Case 3: Generic HTTP URL
    if remote_location.endswith("version.txt"):
        files_url = remote_location[:-11] + "files.txt"
    else:
        files_url = remote_location.rstrip("/") + "/files.txt"
    try:
        content = http_get(files_url).decode("utf-8")
        return parse_files_manifest(content)
    except Exception as e:
        print(f"[!] Error fetching remote files.txt from {files_url}: {e}")
        return None


def fetch_remote_version(remote_location: str) -> Optional[str]:
    """Retrieves the remote version.txt content from the remote location."""
    remote_location = remote_location.strip()

    # Case 1: Local file/directory path
    if remote_location.startswith("file://") or os.path.exists(remote_location):
        local_path_str = remote_location[7:] if remote_location.startswith("file://") else remote_location
        local_path = Path(local_path_str)
        ver_file = local_path / "version.txt" if local_path.is_dir() else local_path
        if ver_file.exists():
            return ver_file.read_text(encoding="utf-8").strip()
        return None

    # Case 2: GitHub repository URL
    gh = GitHubRepoLocation.parse(remote_location)
    if gh:
        version_url = gh.get_version_url()
        try:
            content = http_get(version_url)
            return content.decode("utf-8").strip()
        except urllib.error.HTTPError as e:
            if e.code == 404 and gh.branch == "main":
                # Try fallback branch "master"
                try:
                    fallback_gh = GitHubRepoLocation(gh.owner, gh.repo, "master", gh.subpath)
                    content = http_get(fallback_gh.get_version_url())
                    return content.decode("utf-8").strip()
                except Exception:
                    pass
            print(f"[!] Failed to fetch version from {version_url}: HTTP {e.code}")
            return None
        except Exception as e:
            print(f"[!] Error fetching remote version from {version_url}: {e}")
            return None

    # Case 3: Generic HTTP URL
    ver_url = remote_location.rstrip("/") + "/version.txt" if not remote_location.endswith("version.txt") else remote_location
    try:
        content = http_get(ver_url)
        return content.decode("utf-8").strip()
    except Exception as e:
        print(f"[!] Error fetching remote version from {ver_url}: {e}")
        return None


def pause_requested() -> bool:
    """True while the window asks downloads to wait (the file Updater/_work/pause exists)."""
    return SETTINGS.work_dir is not None and (SETTINGS.work_dir / PAUSE_FILENAME).exists()


class DownloadProgress:
    """Counts the files and bytes of one download and prints how far it has got.

    The window reads the line, so its format stays as it is:
    "[*] Downloaded {done}/{total} files, {mb:.1f} MB, {speed:.1f} MB/s, about {m}:{ss:02d} left".
    A line is printed after a file at most every PROGRESS_EVERY seconds, and once at the
    end. Time spent paused is left out of the speed. Safe to use from several workers.
    """

    def __init__(self, total: int):
        self.total = total
        self.done = 0
        self.bytes = 0
        self.started = time.monotonic()
        self.paused_for = 0.0
        self.paused_since: Optional[float] = None
        self.last_print: Optional[float] = None
        self.lock = threading.Lock()

    def line(self, now: float) -> str:
        paused = self.paused_for + (now - self.paused_since if self.paused_since is not None else 0.0)
        elapsed = max(now - self.started - paused, 1e-6)
        speed = self.bytes / MB / elapsed
        # (total - done) files of the average size so far, at the speed so far
        left = (self.total - self.done) * elapsed / self.done if self.done else 0.0
        secs = max(int(round(left)), 0)
        return (f"[*] Downloaded {self.done}/{self.total} files, {self.bytes / MB:.1f} MB, "
                f"{speed:.1f} MB/s, about {secs // 60}:{secs % 60:02d} left")

    def file_done(self, nbytes: int) -> None:
        with self.lock:
            self.done += 1
            self.bytes += nbytes
            now = time.monotonic()
            if self.done < self.total and (self.last_print is None or now - self.last_print >= PROGRESS_EVERY):
                self.last_print = now
                print(self.line(now), flush=True)

    def finish(self) -> None:
        with self.lock:
            print(self.line(time.monotonic()), flush=True)

    def wait_if_paused(self) -> None:
        """Waits while the pause file exists (a stop request ends the wait). "[*] Paused" and
        "[*] Resumed" are printed once per pause, however many workers wait."""
        if not pause_requested():
            return
        with self.lock:
            if self.paused_since is None and pause_requested():
                self.paused_since = time.monotonic()
                print("[*] Paused", flush=True)
        while pause_requested() and not stop_requested():
            time.sleep(PAUSE_POLL)
        with self.lock:
            if self.paused_since is not None:
                self.paused_for += time.monotonic() - self.paused_since
                self.paused_since = None
                print("[*] Resumed", flush=True)


def download_many(items: List[Tuple[str, str, str]], staging_dir: Path) -> str:
    """Downloads (rel_path, url, sha256) items into staging_dir, DOWNLOAD_WORKERS at a time.

    Returns "ok", "bad-sha" (a file arrived with the wrong sha256: never retried from
    another source) or "failed" (a download did not complete). Prints progress lines and
    waits before each file while the run is paused.
    """
    if not items:
        return "ok"
    bad = threading.Event()
    failed = threading.Event()
    progress = DownloadProgress(len(items))

    def one(item: Tuple[str, str, str]) -> None:
        rel_path, url, expected_sha = item
        if bad.is_set() or failed.is_set():
            return
        progress.wait_if_paused()
        if bad.is_set() or failed.is_set():
            return
        try:
            content = http_get(url)
        except Exception as e:
            print(f"[-] Download failed for '{rel_path}' from {url}: {e}")
            failed.set()
            return
        if expected_sha:
            actual_sha = compute_sha256_bytes(content)
            if actual_sha != expected_sha.lower():
                print(f"[!] SHA256 integrity check failed for '{rel_path}': expected {expected_sha}, got {actual_sha}")
                bad.set()
                return
        dst_file = staging_dir / Path(rel_path)
        dst_file.parent.mkdir(parents=True, exist_ok=True)
        dst_file.write_bytes(content)
        progress.file_done(len(content))

    print(f"[*] Downloading {len(items)} file(s)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
        list(pool.map(one, items))
    progress.finish()
    if bad.is_set():
        return "bad-sha"
    return "failed" if failed.is_set() else "ok"


def download_remote_files_to_staging(
    remote_location: str,
    files_manifest: Dict[str, str],
    staging_dir: Path,
) -> bool:
    """Downloads only the files listed in files_manifest into staging_dir and verifies sha256."""
    return fetch_files_to_staging(remote_location, files_manifest, staging_dir) == "ok"


def fetch_files_to_staging(
    remote_location: str,
    files_manifest: Dict[str, str],
    staging_dir: Path,
) -> str:
    """download_remote_files_to_staging, telling why it failed.

    Returns "ok", "failed" (the network: a download or the archive did not arrive; the
    files that did arrive are worth keeping for the next run), "bad-sha" (a file arrived
    with the wrong sha256) or "missing" (the source does not hold a listed file).
    """
    remote_location = remote_location.strip()

    # Case 1: Local path (for testing or local repos)
    if remote_location.startswith("file://") or os.path.exists(remote_location):
        local_path_str = remote_location[7:] if remote_location.startswith("file://") else remote_location
        local_path = Path(local_path_str)
        base_dir = local_path if local_path.is_dir() else local_path.parent

        progress = DownloadProgress(len(files_manifest)) if files_manifest else None
        if progress is not None:
            print(f"[*] Downloading {len(files_manifest)} file(s)...")
        try:
            for rel_path, expected_sha in files_manifest.items():
                progress.wait_if_paused()
                src_file = base_dir / Path(rel_path)
                if not src_file.is_file():
                    print(f"[!] Remote file '{rel_path}' not found at local source: {src_file}")
                    return "missing"
                dst_file = staging_dir / Path(rel_path)
                dst_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_file, dst_file)

                if expected_sha:
                    actual_sha = compute_sha256(dst_file)
                    if actual_sha != expected_sha.lower():
                        print(
                            f"[!] SHA256 integrity check failed for '{rel_path}': expected {expected_sha}, got {actual_sha}"
                        )
                        return "bad-sha"
                progress.file_done(dst_file.stat().st_size)
        finally:
            if progress is not None:
                progress.finish()

        # Also copy version.txt if available locally and not already in staging
        local_ver_file = base_dir / "version.txt"
        if local_ver_file.is_file() and not (staging_dir / "version.txt").exists():
            shutil.copy2(local_ver_file, staging_dir / "version.txt")

        return "ok"

    # Case 2: GitHub repo
    gh = GitHubRepoLocation.parse(remote_location)
    if gh:
        # Attempt individual raw downloads first, several at a time
        result = download_many(
            [(rel_path, gh.get_file_url(rel_path), expected_sha) for rel_path, expected_sha in files_manifest.items()],
            staging_dir,
        )
        if result == "bad-sha":
            return "bad-sha"
        all_raw_downloaded = result == "ok"
        if not all_raw_downloaded:
            print("[-] Raw download failed. Will attempt zip archive.")

        if not all_raw_downloaded:
            # Fallback to downloading repo zip and extracting only manifest files
            archive_urls = [
                gh.get_archive_url(),
                f"https://codeload.github.com/{gh.owner}/{gh.repo}/zip/refs/heads/{gh.branch}",
            ]
            if gh.branch == "main":
                archive_urls.append(f"https://github.com/{gh.owner}/{gh.repo}/archive/refs/heads/master.zip")

            zip_bytes = None
            for arc_url in archive_urls:
                try:
                    print(f"[*] Downloading repository archive from {arc_url}...")
                    zip_bytes = http_get(arc_url)
                    break
                except Exception as e:
                    print(f"[-] Failed downloading archive from {arc_url}: {e}")

            if not zip_bytes:
                print("[!] Could not download repository archive from GitHub.")
                return "failed"

            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                namelist = zf.namelist()
                if not namelist:
                    print("[!] Downloaded zip archive is empty.")
                    return "missing"

                root_prefix = namelist[0].split("/")[0]
                base_prefix = f"{root_prefix}/{gh.subpath.strip('/')}/" if gh.subpath else f"{root_prefix}/"

                for rel_path, expected_sha in files_manifest.items():
                    norm_rel = rel_path.replace("\\", "/").lstrip("/")
                    full_zip_entry = f"{base_prefix}{norm_rel}"
                    if full_zip_entry not in namelist:
                        print(f"[!] File '{rel_path}' not found in GitHub archive at '{full_zip_entry}'.")
                        return "missing"

                    dst_file = staging_dir / Path(rel_path)
                    dst_file.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(full_zip_entry) as src, open(dst_file, "wb") as dst:
                        shutil.copyfileobj(src, dst)

                    if expected_sha:
                        actual_sha = compute_sha256(dst_file)
                        if actual_sha != expected_sha.lower():
                            print(
                                f"[!] SHA256 integrity check failed for '{rel_path}': expected {expected_sha}, got {actual_sha}"
                            )
                            return "bad-sha"

                # Extract version.txt if in zip and not in staging
                ver_zip_entry = f"{base_prefix}version.txt"
                if ver_zip_entry in namelist and not (staging_dir / "version.txt").exists():
                    dst_ver = staging_dir / "version.txt"
                    with zf.open(ver_zip_entry) as src, open(dst_ver, "wb") as dst:
                        shutil.copyfileobj(src, dst)

        # Ensure version.txt is retrieved if not present
        if not (staging_dir / "version.txt").exists():
            try:
                v_content = http_get(gh.get_version_url())
                (staging_dir / "version.txt").write_bytes(v_content)
            except Exception:
                pass

        return "ok"

    # Case 3: Generic HTTP URL
    base_url = remote_location.rstrip("/")
    if base_url.endswith("version.txt"):
        base_url = base_url[:-11].rstrip("/")
    items = [
        (rel_path, f"{base_url}/{rel_path.replace(chr(92), '/').lstrip('/')}", expected_sha)
        for rel_path, expected_sha in files_manifest.items()
    ]
    result = download_many(items, staging_dir)
    if result != "ok":
        return result

    if not (staging_dir / "version.txt").exists():
        try:
            v_content = http_get(f"{base_url}/version.txt")
            (staging_dir / "version.txt").write_bytes(v_content)
        except Exception:
            pass

    return "ok"


def create_backup(mod_dir: Path, files_to_backup: List[str], work_root: Optional[Path] = None) -> Tuple[Path, Set[str]]:
    """Creates a backup containing ONLY the files listed in files.txt (plus version.txt).

    With work_root the backup is made there (it survives a killed run), else in the temp folder.
    """
    if work_root is not None:
        backup_root = work_root / "backup"
        shutil.rmtree(backup_root, ignore_errors=True)
        backup_root.mkdir(parents=True, exist_ok=True)
    else:
        backup_root = Path(tempfile.mkdtemp(prefix=f"{mod_dir.name}_backup_"))
    backup_dir = backup_root / mod_dir.name
    backup_dir.mkdir(parents=True, exist_ok=True)
    backed_up_files = set()

    all_targets = list(files_to_backup)
    if "version.txt" not in all_targets:
        all_targets.append("version.txt")

    for rel_path in all_targets:
        norm_path = Path(rel_path.strip().replace("\\", "/").lstrip("/"))
        src_file = mod_dir / norm_path
        if src_file.is_file():
            dst_file = backup_dir / norm_path
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            backed_up_files.add(str(norm_path).replace("\\", "/"))

    return backup_dir, backed_up_files


def restore_backup(
    backup_dir: Path,
    mod_dir: Path,
    files_in_manifest: List[str],
    backed_up_files: Set[str],
) -> None:
    """Restores only the backed up files to mod_dir and removes any newly created manifest files."""
    print(f"[!] Restoring backup for {mod_dir.name}...")
    all_targets = list(files_in_manifest)
    if "version.txt" not in all_targets:
        all_targets.append("version.txt")

    # Step 1: Restore files that were backed up
    for file_rel in backed_up_files:
        norm_path = Path(file_rel)
        src_file = backup_dir / norm_path
        dst_file = mod_dir / norm_path
        if src_file.is_file():
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)

    # Step 2: Delete files from manifest that were newly created during the failed update
    for rel_path in all_targets:
        norm_str = str(Path(rel_path.strip().replace("\\", "/").lstrip("/"))).replace("\\", "/")
        if norm_str not in backed_up_files:
            dst_file = mod_dir / Path(norm_str)
            if dst_file.is_file():
                try:
                    dst_file.unlink()
                except Exception:
                    pass

    print(f"[+] Backup successfully restored for {mod_dir.name}.")


def log_updated_file(file_path: str | Path, log_file: Optional[Path] = None, mod_name: Optional[str] = None) -> None:
    """Logs an updated file entry into log.txt created in the Updater folder."""
    if log_file is None:
        script_dir = Path(__file__).resolve().parent
        log_file = script_dir / "log.txt"

    log_file.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    mod_prefix = f"[{mod_name}] " if mod_name else ""
    log_entry = f"[{timestamp}] {mod_prefix}Updated: {file_path}\n"

    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"[!] Warning: Could not write to log file {log_file}: {e}")


def check_local_files_sha256_mismatches(
    mod_dir: Path, files_manifest: Dict[str, str]
) -> Tuple[List[str], List[str]]:
    """Compares local files against the remote SHA256 manifest.

    Returns:
        (mismatched_or_missing_files, matching_files)
    """
    mismatches = []
    matches = []

    for rel_path, expected_sha in files_manifest.items():
        norm_path = Path(rel_path.strip().replace("\\", "/").lstrip("/"))
        local_file = mod_dir / norm_path

        if not local_file.is_file():
            mismatches.append(rel_path)
            continue

        if not expected_sha:
            # If no sha is given in manifest, existence check is used
            matches.append(rel_path)
            continue

        local_sha = compute_sha256(local_file)
        if local_sha != expected_sha.lower():
            mismatches.append(rel_path)
        else:
            matches.append(rel_path)

    return mismatches, matches


def apply_mod_update(
    staging_dir: Path,
    mod_dir: Path,
    backup_dir: Path,
    files_manifest: Dict[str, str],
    backed_up_files: Set[str],
    fallback_version: Optional[str] = None,
    log_file: Optional[Path] = None,
    mod_name: Optional[str] = None,
    only_files: Optional[List[str]] = None,
    removed_files: Optional[List[str]] = None,
) -> bool:
    """Applies the downloaded update from staging to mod_dir without deleting unlisted files.

    only_files: the manifest files that were downloaded (the others already match locally);
    None means every manifest file. removed_files: files the previous update brought that
    the new manifest no longer lists; they are deleted (they are in the backup).
    """
    manifest_files = list(files_manifest.keys())
    copy_files = manifest_files if only_files is None else list(only_files)
    updated_files_log: List[Path] = []
    try:
        # Step 1: Copy all staging files in manifest EXCEPT version.txt first
        for rel_path in copy_files:
            norm_rel = Path(rel_path)
            if norm_rel.name == "version.txt" or str(norm_rel).replace("\\", "/") == "version.txt":
                continue

            staging_file = staging_dir / norm_rel
            if not staging_file.is_file():
                raise FileNotFoundError(f"Staged file not found: {staging_file}")

            dest_file = mod_dir / norm_rel
            if not is_inside(dest_file, mod_dir):
                raise ValueError(f"'{rel_path}' is outside {mod_dir}; not written.")
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(staging_file, dest_file)

            # Integrity verification on the target file
            expected_sha = files_manifest.get(rel_path)
            if expected_sha:
                target_sha = compute_sha256(dest_file)
                if target_sha != expected_sha.lower():
                    raise ValueError(
                        f"Integrity check failed on written file {dest_file}: expected {expected_sha}, got {target_sha}"
                    )

            updated_files_log.append(dest_file)

        # Step 1b: files the previous update brought that this one no longer lists
        for rel_path in removed_files or []:
            gone = mod_dir / Path(rel_path)
            if not is_safe_rel_path(rel_path) or not is_inside(gone, mod_dir):
                print(f"[!] Not removing '{rel_path}': it is outside {mod_dir.name}.")
                continue
            if gone.is_file():
                gone.unlink()
                print(f"[+] Removed '{rel_path}' (no longer part of {mod_dir.name}).")

        # Step 2: Absolute last step - update version.txt only after all other files are verified in place
        staging_version_file = staging_dir / "version.txt"
        dest_version_file = mod_dir / "version.txt"

        if staging_version_file.is_file():
            expected_ver_sha = files_manifest.get("version.txt")
            if expected_ver_sha:
                ver_sha = compute_sha256(staging_version_file)
                if ver_sha != expected_ver_sha.lower():
                    raise ValueError(
                        f"SHA256 mismatch for version.txt: expected {expected_ver_sha}, got {ver_sha}"
                    )
            shutil.copy2(staging_version_file, dest_version_file)
            updated_files_log.append(dest_version_file)
        elif fallback_version:
            dest_version_file.write_text(f"{fallback_version.strip()}\n", encoding="utf-8")
            updated_files_log.append(dest_version_file)
        else:
            raise RuntimeError(f"No version.txt found in staging and no fallback version provided for {mod_dir.name}.")

        # Step 3: Log all successfully updated files into log.txt
        effective_mod_name = mod_name or mod_dir.name
        for updated_file in updated_files_log:
            log_updated_file(updated_file, log_file=log_file, mod_name=effective_mod_name)

        print(f"[+] Successfully applied files and version for {mod_dir.name}.")
        return True

    except Exception as e:
        print(f"[!] Error occurred during mod update application: {e}")
        restore_backup(backup_dir, mod_dir, copy_files, backed_up_files)
        return False


def report(target_name: str, status: str, **fields) -> None:
    """Records what happened to one component in this run (written to last_run.json)."""
    entry = {"status": status}
    entry.update({k: v for k, v in fields.items() if v is not None})
    SETTINGS.report[target_name] = entry


def safe_name(target_name: str) -> str:
    """The name a component's folders in the Updater go by (work, state, rollback)."""
    return re.sub(r"[^\w\-]", "_", target_name)


def _state_file_in(state_dir: Optional[Path], target_name: str) -> Optional[Path]:
    if state_dir is None:
        return None
    return state_dir / (safe_name(target_name) + ".files.txt")


def _state_file(target_name: str) -> Optional[Path]:
    return _state_file_in(SETTINGS.state_dir, target_name)


def previous_manifest(target_name: str) -> Dict[str, str]:
    """The manifest this component was last updated to by this updater ({} when unknown)."""
    f = _state_file(target_name)
    if f is None or not f.is_file():
        return {}
    return parse_files_manifest(f.read_text(encoding="utf-8"))


def remember_manifest(target_name: str, files_manifest: Dict[str, str]) -> None:
    f = _state_file(target_name)
    if f is None:
        return
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text("".join(f"{sha}  {path}\n" for path, sha in sorted(files_manifest.items())), encoding="utf-8")


def _journal_path(work: Path) -> Path:
    return work / "journal.json"


def clear_work_except_staging(work: Path) -> None:
    """Empties a component's work folder but keeps its downloaded files (staging) for the
    next run; the folder goes entirely when nothing was downloaded."""
    staging = work / "staging"
    if not staging.is_dir() or not any(p.is_file() for p in staging.rglob("*")):
        shutil.rmtree(work, ignore_errors=True)
        return
    for child in work.iterdir():
        if child.name == "staging":
            continue
        try:
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink()
        except Exception:
            pass


def recover_interrupted_updates() -> List[str]:
    """Rolls back any update a previous run left half applied (the run was killed mid copy).

    Each component's work folder holds its backup and a journal while files are being
    replaced; a journal still there at start means the copy did not finish, and the
    folder is removed after the rollback. A work folder without a journal belongs to a
    run killed (or cut off from the network) while downloading: its staging folder is
    kept so the next update does not fetch those files again.
    """
    if SETTINGS.work_dir is None or not SETTINGS.work_dir.is_dir():
        return []
    recovered = []
    for work in sorted(p for p in SETTINGS.work_dir.iterdir() if p.is_dir()):
        journal = _journal_path(work)
        if journal.is_file():
            try:
                j = json.loads(journal.read_text(encoding="utf-8"))
                restore_backup(work / "backup" / j["dir_name"], Path(j["target_dir"]), j["files"], set(j["backed_up"]))
                recovered.append(j.get("name", work.name))
                print(f"[+] Rolled back the unfinished update of {j.get('name', work.name)} from the last run.")
            except Exception as e:
                print(f"[!] Could not roll back the unfinished update in {work}: {e}")
                continue
            shutil.rmtree(work, ignore_errors=True)
        else:
            clear_work_except_staging(work)
    return recovered


def keep_staged_files(staging_dir: Path, fetch_manifest: Dict[str, str]) -> Dict[str, str]:
    """Keeps what an earlier, interrupted run already downloaded into staging_dir.

    A staged file whose sha256 matches the manifest is kept; one with another sha256 (or
    none to check against) is deleted, and so is any staged file this update does not
    fetch (an older version.txt among them). Returns the files still to download.
    """
    for staged in sorted(staging_dir.rglob("*"), reverse=True):
        if staged.is_file() and staged.relative_to(staging_dir).as_posix() not in fetch_manifest:
            try:
                staged.unlink()
            except Exception:
                pass
    to_fetch: Dict[str, str] = {}
    kept = 0
    for rel_path, expected_sha in fetch_manifest.items():
        staged = staging_dir / Path(rel_path)
        if staged.is_file():
            if expected_sha and compute_sha256(staged) == expected_sha.lower():
                kept += 1
                continue
            try:
                staged.unlink()
            except Exception:
                pass
        to_fetch[rel_path] = expected_sha
    if kept:
        print(f"[*] {kept} file(s) already downloaded in an earlier run; kept.")
    return to_fetch


def mod_json_version(mod_dir: Path) -> str:
    """The "version" a mod's mod.json gives ("" when it gives none or cannot be read)."""
    try:
        meta = json.loads((mod_dir / "mod.json").read_text(encoding="utf-8"))
    except Exception:
        return ""
    v = meta.get("version") if isinstance(meta, dict) else None
    return v.strip() if isinstance(v, str) else ""


def read_name_list(path: Path) -> Set[str]:
    """A list of names, one per line (declined.txt, held.txt); '#' lines are notes."""
    if not path.is_file():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")}


def save_rollback(
    target_name: str,
    backup_dir: Path,
    backed_up_files: Set[str],
    previous_state: Optional[str],
    info: dict,
) -> None:
    """Keeps what is needed to put a mod's previous version back (Updater/rollback/<mod>/).

    files/ holds the files the update replaced (its backup), state.files.txt the manifest
    the mod was at before (when known), rollback.json what --rollback undoes. Only the
    latest update of each mod is kept.
    """
    if SETTINGS.rollback_dir is None:
        return
    store = SETTINGS.rollback_dir / safe_name(target_name)
    new = store.with_name(store.name + ".new")
    try:
        shutil.rmtree(new, ignore_errors=True)
        new.mkdir(parents=True)
        if backup_dir.is_dir():
            shutil.copytree(backup_dir, new / "files")
        else:
            (new / "files").mkdir()
        if previous_state is not None:
            (new / "state.files.txt").write_text(previous_state, encoding="utf-8")
        (new / "rollback.json").write_text(json.dumps(info, indent=1), encoding="utf-8")
        shutil.rmtree(store, ignore_errors=True)
        new.rename(store)
        print(f"[*] {target_name} {info.get('version') or 'unknown'} is kept so the update can be rolled back.")
    except Exception as e:
        shutil.rmtree(new, ignore_errors=True)
        print(f"[!] Could not keep the previous version of {target_name} for a rollback: {e}")


def rollback_mod(
    name: str,
    mods_dir: Path,
    rollback_dir: Optional[Path],
    state_dir: Optional[Path] = None,
    held_file: Optional[Path] = None,
) -> bool:
    """--rollback NAME: puts back the version a mod had before its last update.

    Copies the kept files back over the mod folder, deletes the files that update added,
    restores the manifest the mod was at, names the mod in held.txt (so it is not updated
    again until the window takes the name out) and deletes the kept copy. No network.
    """
    held_file = held_file or Path(__file__).resolve().parent / HELD_FILENAME
    store = rollback_dir / safe_name(name) if rollback_dir is not None else None
    if not SAFE_NAME.match(name):
        print(f"[!] '{name}' is not a mod folder name; nothing rolled back.")
        report(name, "failed", reason="unsafe name")
        return False
    if store is None or not (store / "rollback.json").is_file():
        print(f"[!] Nothing to roll back for {name}: no earlier version of it is kept.")
        report(name, "failed", reason="nothing to roll back")
        return False
    mod_dir = mods_dir / name
    if not mod_dir.is_dir():
        print(f"[!] {name} is not installed at {mod_dir}; nothing rolled back.")
        report(name, "failed", reason="not installed")
        return False
    try:
        info = json.loads((store / "rollback.json").read_text(encoding="utf-8"))
        kept = store / "files"
        for rel_path in info.get("backed_up", []):
            src = kept / Path(rel_path)
            dst = mod_dir / Path(rel_path)
            if not is_safe_rel_path(rel_path) or not is_inside(dst, mod_dir) or not src.is_file():
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        for rel_path in info.get("added", []):
            dst = mod_dir / Path(rel_path)
            if is_safe_rel_path(rel_path) and is_inside(dst, mod_dir) and dst.is_file():
                dst.unlink()
        state_file = _state_file_in(state_dir, name)
        if state_file is not None:
            if (store / "state.files.txt").is_file():
                state_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(store / "state.files.txt", state_file)
            else:
                state_file.unlink(missing_ok=True)
        held = read_name_list(held_file)
        if name not in held:
            text = held_file.read_text(encoding="utf-8") if held_file.is_file() else ""
            if text and not text.endswith("\n"):
                text += "\n"
            held_file.parent.mkdir(parents=True, exist_ok=True)
            held_file.write_text(text + name + "\n", encoding="utf-8")
        shutil.rmtree(store, ignore_errors=True)
    except Exception as e:
        print(f"[!] Could not roll back {name}: {e}")
        report(name, "failed", reason=str(e))
        return False
    version = info.get("version") or ""
    print(f"[+] {name} rolled back from {info.get('to') or 'unknown'} to {version or 'unknown'}; held until released.")
    report(name, "rolled-back", local=info.get("to"), remote=version)
    return True


def stop_requested() -> bool:
    """True when the window asked the updater to stop after the component it is on."""
    return SETTINGS.work_dir is not None and (SETTINGS.work_dir / "stop").exists()


def update_directory_target(
    target_name: str,
    target_dir: Path,
    repo_location: str,
    log_file: Optional[Path] = None,
    create: bool = False,
    adopt: bool = False,
    keep_rollback: bool = False,
) -> bool:
    """Checks and updates a single target directory (Mod, Launcher, Gui, Updater) if present.

    adopt and keep_rollback are given for mods only (never Launcher, Gui or the Updater):
    adopt takes in a mod folder that holds a mod.json but no version.txt (added from a
    zip) with mod.json's version; keep_rollback keeps the files an update replaces so
    --rollback can put them back. A mod named in held.txt is not updated.

    Manifest-driven update logic:
    1. Checks if target_dir exists and has a version.txt (with install-new, a listed
       mod that is missing is created unless the player deleted it; create=True
       creates it whatever the settings: a dependency of an installed mod).
    2. Fetches remote version and compares against local version.
    3. Fetches remote files.txt manifest.
    4. Compares SHA256 checksums of local files against remote manifest.
    5. Decides by the channel's rules: stable updates to a higher version, or repairs
       damaged files at the same version, and keeps a newer local version; an exact
       channel makes the folder match the remote whatever the versions.
    6. Backs up only the files that will change, downloads only those (several at a
       time, sha256-checked), applies them (version.txt last), deletes files the
       previous update brought that the manifest no longer lists, and restores the
       backup if anything fails. With a work folder, files downloaded by a run that
       was killed or lost the network are kept in its staging folder and not fetched
       again when their sha256 still matches.
    """
    local_version_file = target_dir / "version.txt"
    creating = False
    adopted = False
    is_mod = adopt or keep_rollback

    if adopt and target_dir.is_dir() and not local_version_file.exists() and (target_dir / "mod.json").is_file():
        # added from a zip: taken in and checked like an installed mod
        adopted = True
    # Rule: Do not download/update if target folder or version.txt is missing
    elif not target_dir.exists() or not local_version_file.exists():
        wanted = create or (SETTINGS.install_new and target_dir.name not in SETTINGS.declined)
        if wanted and not target_dir.exists():
            # only a plain folder name, made directly in the mods folder
            if not SAFE_NAME.match(target_dir.name) or target_dir.name in (".", ".."):
                print(f"[!] '{target_name}' is not a usable folder name; not installed.")
                report(target_name, "failed", reason="unsafe name")
                return False
            creating = True
        elif SETTINGS.install_new and not target_dir.exists() and target_dir.name in SETTINGS.declined:
            # deleted by the player: not brought back, but its newest version is noted so the Terminal can offer it
            remote_version = fetch_remote_version(repo_location)
            print(f"[-] '{target_name}' was deleted by the player; not installed (channel has {remote_version or 'no version'}).")
            report(target_name, "declined", remote=remote_version)
            return False
        else:
            print(f"[-] '{target_name}' is not present at {target_dir} (or missing version.txt). Skipping...")
            report(target_name, "absent")
            return False

    if adopted:
        local_version = mod_json_version(target_dir)
        print(f"[*] {target_name} has no version.txt (added from a zip); adopted with version {local_version or 'unknown'}.")
    else:
        local_version = "" if creating else local_version_file.read_text(encoding="utf-8").strip()

    def rep(status: str, **fields) -> None:
        report(target_name, status, adopted=True if adopted else None, **fields)

    if is_mod and not creating and target_name in SETTINGS.held:
        print(f"[=] {target_name} is held at {local_version or 'unknown'} (rolled back); not updated.")
        rep("held", local=local_version)
        return False

    print(f"[*] Checking {target_name} (Local version: {local_version or 'not installed'})...")

    remote_version = fetch_remote_version(repo_location)
    if not remote_version:
        gh = GitHubRepoLocation.parse(repo_location)
        if gh and not_published(gh.get_version_url()):
            print(f"[-] {target_name} is not on the '{SETTINGS.channel}' channel yet (no version.txt there). Nothing to do.")
            rep("unpublished", local=local_version)
            return False
        print(f"[!] Could not retrieve remote version for {target_name}.")
        rep("unreachable", local=local_version)
        return False

    print(f"[*] Remote version for {target_name}: {remote_version}")

    # Fetch files.txt from the same place remote version.txt is read
    files_manifest = fetch_remote_files_manifest(repo_location)
    if files_manifest is None:
        print(f"[!] Could not retrieve remote files.txt for {target_name}. Aborting update check.")
        rep("unreachable", local=local_version, remote=remote_version)
        return False

    if not files_manifest:
        print(f"[!] Remote files.txt is empty for {target_name}. Nothing to check or download.")
        rep("failed", local=local_version, remote=remote_version, reason="empty files.txt")
        return False

    # Check for version changes and local SHA256 mismatches/missing files
    has_newer_version = is_newer_version(remote_version, local_version)
    local_is_newer = not creating and is_newer_version(local_version, remote_version)
    mismatched_files, _ = check_local_files_sha256_mismatches(target_dir, files_manifest)
    removed_files = [p for p in previous_manifest(target_name) if p not in files_manifest]
    version_differs = local_version != remote_version

    if local_is_newer and not SETTINGS.exact:
        # A development build (or a player's own edit with a higher number) is never replaced by an older release
        print(f"[=] {target_name} {local_version} is newer than this channel's {remote_version}; kept as it is.")
        rep("newer-local", local=local_version, remote=remote_version)
        return False

    if not version_differs and not mismatched_files and not removed_files:
        print(f"[=] {target_name} is up to date and all SHA256 checksums match (Version: {local_version}).")
        rep("current", local=local_version)
        return False

    if creating:
        print(f"[+] {target_name} is part of the '{SETTINGS.channel}' channel and not installed. Installing {remote_version}...")
    elif has_newer_version:
        print(f"[+] Higher version found for {target_name} ({local_version} -> {remote_version}). Starting update...")
    elif version_differs:
        print(f"[+] The '{SETTINGS.channel}' channel holds {target_name} {remote_version} (local {local_version}). Matching it...")
    elif mismatched_files:
        print(
            f"[!] SHA256 mismatch or missing files detected for {target_name} ({len(mismatched_files)} file(s): {', '.join(mismatched_files[:20])}). Retrieving latest files..."
        )

    print(f"[*] Retrieved manifest with {len(files_manifest)} file(s) for {target_name}; {len(mismatched_files)} to fetch.")

    if SETTINGS.check_only:
        rep("available", local=local_version, remote=remote_version,
            files=len(mismatched_files), removed=len(removed_files))
        return False

    fetch_manifest = {p: files_manifest[p] for p in mismatched_files}
    change_list = list(fetch_manifest.keys()) + removed_files

    safe_prefix = safe_name(target_name)
    work = SETTINGS.work_dir / safe_prefix if SETTINGS.work_dir is not None else None
    if creating:
        target_dir.mkdir(parents=True, exist_ok=True)

    # Create backup containing ONLY the files that will change (plus version.txt)
    backup_dir, backed_up_files = create_backup(target_dir, change_list, work_root=work)
    if work is not None:
        # an earlier run's downloads are kept (keep_staged_files checks them)
        staging_dir = work / "staging"
        staging_dir.mkdir(parents=True, exist_ok=True)
    else:
        staging_dir = Path(tempfile.mkdtemp(prefix=f"{safe_prefix}_staging_"))
    keep_staging = False

    def fail(reason: str) -> bool:
        rep("failed", local=local_version, remote=remote_version, reason=reason)
        if creating and not any(target_dir.iterdir()):
            shutil.rmtree(target_dir, ignore_errors=True)
        return False

    try:
        # Download ONLY the files that differ to staging directory and verify sha256
        to_fetch = keep_staged_files(staging_dir, fetch_manifest) if work is not None else fetch_manifest
        download_result = fetch_files_to_staging(repo_location, to_fetch, staging_dir)
        if download_result != "ok":
            print(f"[!] Failed to download/verify files for {target_name}. Restoring backup.")
            restore_backup(backup_dir, target_dir, change_list, backed_up_files)
            if download_result == "failed" and work is not None:
                # the network: what did arrive is kept for the next run
                keep_staging = True
                print(f"[*] The files of {target_name} downloaded so far are kept for the next run.")
            return fail("download or sha256 check failed")

        if work is not None:
            _journal_path(work).write_text(json.dumps({
                "name": target_name, "target_dir": str(target_dir), "dir_name": backup_dir.name,
                "files": change_list, "backed_up": sorted(backed_up_files),
            }), encoding="utf-8")

        # Apply update (copies changed files first, then version.txt last, rolls back on error)
        apply_success = apply_mod_update(
            staging_dir=staging_dir,
            mod_dir=target_dir,
            backup_dir=backup_dir,
            files_manifest=files_manifest,
            backed_up_files=backed_up_files,
            fallback_version=remote_version,
            log_file=log_file,
            mod_name=target_name,
            only_files=list(fetch_manifest.keys()),
            removed_files=removed_files,
        )
        if not apply_success:
            return fail("files could not be written")

        if keep_rollback and not creating:
            state_file = _state_file(target_name)
            previous_state = state_file.read_text(encoding="utf-8") if state_file and state_file.is_file() else None
            written = set(fetch_manifest) | {"version.txt"}
            save_rollback(target_name, backup_dir, backed_up_files, previous_state, {
                "name": target_name,
                "version": local_version,
                "to": remote_version,
                "backed_up": sorted(backed_up_files),
                "added": sorted(p for p in written if p not in backed_up_files),
                "removed": sorted(removed_files),
                "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })

        remember_manifest(target_name, files_manifest)
        print(f"[+] '{target_name}' successfully updated to version {remote_version}!")
        rep("installed" if creating else "updated", local=local_version, remote=remote_version,
            files=len(fetch_manifest), removed=len(removed_files))
        return True

    except Exception as e:
        print(f"[!] Unexpected error during update of {target_name}: {e}")
        restore_backup(backup_dir, target_dir, change_list, backed_up_files)
        return fail(str(e))

    finally:
        # Cleanup temporary staging and backup files (the journal goes first: the files are settled)
        if work is not None:
            try:
                _journal_path(work).unlink(missing_ok=True)
            except Exception:
                pass
        if keep_staging:
            # the backup goes; the downloads stay for the next run
            clear_work_except_staging(work)
        else:
            try:
                if staging_dir.exists():
                    shutil.rmtree(staging_dir)
            except Exception:
                pass
            try:
                if backup_dir.parent.exists():
                    shutil.rmtree(backup_dir.parent)
            except Exception:
                pass
            if work is not None:
                shutil.rmtree(work, ignore_errors=True)



def update_mod(
    mod_name: str,
    repo_location: str,
    mods_dir: Path,
    log_file: Optional[Path] = None,
) -> bool:
    """Checks and updates a single mod if present in mods folder (a mod added from a zip is
    adopted; the previous version is kept for --rollback)."""
    return update_directory_target(
        target_name=mod_name,
        target_dir=mods_dir / mod_name,
        adopt=True,
        keep_rollback=True,
        repo_location=repo_location,
        log_file=log_file,
    )


def update_repositories_group(
    repositories_file: Path,
    target_base_dir: Path,
    remote_url: Optional[str] = None,
    log_file: Optional[Path] = None,
    is_single_component_dir: bool = False,
    component_name: Optional[str] = None,
) -> Dict[str, bool]:
    """Updates one or more components defined in a repositories file.

    If is_single_component_dir is True:
        All entries or direct entry in repositories_file update `target_base_dir` directly.
    Otherwise:
        Entries in repositories_file update subdirectories `<target_base_dir>/<entry_name>`.
    """
    if remote_url:
        sync_repositories_file(repositories_file, remote_url=remote_url)
        if not list_is_from(repositories_file, remote_url):
            # The channel's own list could not be read: another channel's list would update
            # (or, on an exact channel, downgrade) everything to the wrong builds
            print(f"[!] No list for the '{SETTINGS.channel}' channel could be read from {list_source(remote_url)}; "
                  f"{repositories_file.name} came from another channel or place. Nothing in it is checked.")
            name = component_name or repositories_file.stem
            if not_published(pinned_raw_url(remote_url)):
                report(name, "unpublished", reason=f"no list for channel {SETTINGS.channel} yet")
            else:
                report(name, "unreachable", reason=f"no list for channel {SETTINGS.channel}")
            return {}

    repositories = parse_repositories_file(repositories_file, default_key=component_name)
    if not repositories:
        print(f"[!] No repository entries found in {repositories_file}.")
        return {}

    results = {}
    for name, repo_location in repositories.items():
        if stop_requested():
            effective_name = (component_name or name) if is_single_component_dir else name
            print(f"[-] Stopped before {effective_name}: asked to stop.")
            report(effective_name, "stopped")
            results[effective_name] = False
            continue
        if is_single_component_dir:
            effective_target_dir = target_base_dir
            effective_target_name = component_name or name
        else:
            if not SAFE_NAME.match(name):
                print(f"[!] Skipping '{name}' in {repositories_file.name}: not a plain mod folder name.")
                report(name, "failed", reason="unsafe name")
                results[name] = False
                continue
            effective_target_dir = target_base_dir / name
            effective_target_name = name

        print(f"\n--- Checking: {effective_target_name} ---")
        try:
            # mods (not Launcher, Gui or the Updater) are adopted from a zip and kept for a rollback
            updated = update_directory_target(
                target_name=effective_target_name,
                target_dir=effective_target_dir,
                repo_location=repo_location,
                log_file=log_file,
                adopt=not is_single_component_dir,
                keep_rollback=not is_single_component_dir,
            )
            results[effective_target_name] = updated
        except Exception as e:
            print(f"[!] Error processing '{effective_target_name}': {e}")
            report(effective_target_name, "failed", reason=str(e))
            results[effective_target_name] = False

    if not is_single_component_dir:
        results.update(install_missing_dependencies(repositories, target_base_dir, log_file))
    return results


def mod_dependencies(mod_dir: Path) -> List[str]:
    """The mods a mod's mod.json says it needs ("dependencies": ["id", ...])."""
    try:
        meta = json.loads((mod_dir / "mod.json").read_text(encoding="utf-8"))
    except Exception:
        return []
    deps = meta.get("dependencies") if isinstance(meta, dict) else None
    return [d for d in deps if isinstance(d, str) and SAFE_NAME.match(d)] if isinstance(deps, list) else []


def install_missing_dependencies(
    repositories: Dict[str, str],
    mods_dir: Path,
    log_file: Optional[Path] = None,
) -> Dict[str, bool]:
    """Every installed mod gets the mods it depends on. A dependency that is neither in the mods folder
    nor in the loader's own shared folder (Launcher/shared) is installed from the list, whatever
    install-new says and even if the player once deleted it; one the list does not carry is reported
    as "missing-dependency". Repeats until nothing more is needed (a dependency's own dependencies)."""
    results: Dict[str, bool] = {}
    shared_dir = mods_dir.parent / "shared"
    tried: Set[str] = set()
    while not stop_requested():
        needed: Dict[str, str] = {}
        if mods_dir.is_dir():
            for mod_dir in sorted(p for p in mods_dir.iterdir() if p.is_dir()):
                for dep in mod_dependencies(mod_dir):
                    if dep in tried or (mods_dir / dep).is_dir() or (shared_dir / dep).is_dir():
                        continue
                    needed.setdefault(dep, mod_dir.name)
        if not needed:
            break
        for dep, needed_by in needed.items():
            tried.add(dep)
            if dep not in repositories:
                print(f"[!] {needed_by} needs '{dep}', which this channel does not carry.")
                report(dep, "missing-dependency", needed_by=needed_by)
                results[dep] = False
                continue
            print(f"\n--- Installing {dep}: {needed_by} needs it ---")
            try:
                results[dep] = update_directory_target(dep, mods_dir / dep, repositories[dep], log_file, create=True)
            except Exception as e:
                print(f"[!] Error installing dependency '{dep}': {e}")
                report(dep, "failed", reason=str(e))
                results[dep] = False
    return results


def run_updater(
    repositories_file: Optional[Path] = None,
    mods_dir: Optional[Path] = None,
    remote_repositories_url: Optional[str] = None,
    log_file: Optional[Path] = None,
    launcher_repositories_file: Optional[Path] = None,
    launcher_dir: Optional[Path] = None,
    remote_launcher_repositories_url: Optional[str] = None,
    gui_repositories_file: Optional[Path] = None,
    gui_dir: Optional[Path] = None,
    remote_gui_repositories_url: Optional[str] = None,
    check_launcher: bool = True,
    check_gui: bool = True,
    check_mods: bool = True,
    channel: Optional[str] = None,
    exact: Optional[bool] = None,
    install_new: Optional[bool] = None,
    token: Optional[str] = None,
    pin_commits: bool = False,
    check_only: bool = False,
    work_dir: Optional[Path] = None,
    state_dir: Optional[Path] = None,
    check_updater: bool = False,
    updater_dir: Optional[Path] = None,
    updater_repositories_file: Optional[Path] = None,
    remote_updater_repositories_url: Optional[str] = None,
    declined_file: Optional[Path] = None,
    held_file: Optional[Path] = None,
    rollback_dir: Optional[Path] = None,
) -> Dict[str, bool]:
    """Runs the update process for Launcher, Gui, and mods.

    1. Checks and synchronizes local repositories files with remote URLs:
       - launcher_repositories.txt from LAUNCHER_REPOSITORY_URL
       - Gui_repositories.txt from GUI_REPOSITORY_URL
       - repositories.txt from REPOSITORIES_URL
       (for a channel other than stable, the same lists in the Update Center's <channel>/ folder)
    2. Updates Launcher in launcher_dir using launcher_repositories.txt.
    3. Updates Gui in gui_dir using Gui_repositories.txt.
    4. Updates installed mods in mods_dir using repositories.txt; with install-new, adds
       listed mods that are missing (not ones in Updater/declined.txt); always adds the
       mods an installed mod depends on.
    5. With check_updater, updates the updater itself from updater_repositories.txt, last,
       so this run finishes with the code it started with.
    6. Logs any updated files to log_file.

    The channel and its rules come from the arguments, else from Updater/channel.txt,
    else stable. work_dir keeps backups where a killed run can be rolled back from at the
    next start; state_dir keeps the manifest each component was updated to, so files a
    component stops shipping are removed; rollback_dir keeps the files each mod update
    replaced, for --rollback. All three are off unless given (main() gives them).
    Mods named in held_file (default Updater/held.txt) are not updated.
    """
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent

    global SETTINGS
    SETTINGS = RunSettings()
    chan = read_channel_file(script_dir / CHANNEL_FILENAME)
    SETTINGS.channel = (channel or chan.get("channel") or DEFAULT_CHANNEL).strip().lower()
    SETTINGS.exact = bool(exact) if exact is not None else is_yes(chan.get("exact"))
    SETTINGS.install_new = bool(install_new) if install_new is not None else is_yes(chan.get("install-new"))
    SETTINGS.declined = read_name_list(declined_file or script_dir / DECLINED_FILENAME)
    SETTINGS.held = read_name_list(held_file or script_dir / HELD_FILENAME)
    SETTINGS.rollback_dir = rollback_dir
    if token is None and chan.get("token-file"):
        token_path = Path(chan["token-file"])
        if not token_path.is_absolute():
            token_path = script_dir / token_path
        if token_path.is_file():
            token = token_path.read_text(encoding="utf-8").strip() or None
    if token is None:
        token = os.environ.get(TOKEN_ENV) or None
    SETTINGS.token = token
    lists = (chan.get("lists") or "").strip()
    SETTINGS.lists = lists if lists.startswith(("https://", "file://")) else None
    SETTINGS.pin_commits = pin_commits
    SETTINGS.check_only = check_only
    SETTINGS.work_dir = work_dir
    SETTINGS.state_dir = state_dir
    _PINNED_REFS.clear()
    print(f"[*] Channel: {SETTINGS.channel}" + (" (exact)" if SETTINGS.exact else "") + (" (check only)" if check_only else ""))
    if work_dir is not None and not check_only:
        recover_interrupted_updates()
        try:
            (work_dir / "stop").unlink(missing_ok=True)
        except Exception:
            pass

    # Mods configuration
    is_default_repos_file = False
    if repositories_file is None:
        repositories_file = script_dir / DEFAULT_MODS_REPOSITORIES_FILENAME
        if not repositories_file.exists():
            repositories_file = project_root / "Updater" / DEFAULT_MODS_REPOSITORIES_FILENAME
        is_default_repos_file = True

    if mods_dir is None:
        mods_dir = project_root / "Launcher" / "mods"

    # Launcher configuration
    is_default_launcher_repos_file = False
    if launcher_repositories_file is None:
        launcher_repositories_file = script_dir / DEFAULT_LAUNCHER_REPOSITORIES_FILENAME
        if not launcher_repositories_file.exists():
            launcher_repositories_file = project_root / "Updater" / DEFAULT_LAUNCHER_REPOSITORIES_FILENAME
        is_default_launcher_repos_file = True

    if launcher_dir is None:
        launcher_dir = project_root / "Launcher"

    # Gui configuration
    is_default_gui_repos_file = False
    if gui_repositories_file is None:
        gui_repositories_file = script_dir / DEFAULT_GUI_REPOSITORIES_FILENAME
        if not gui_repositories_file.exists():
            gui_repositories_file = project_root / "Updater" / DEFAULT_GUI_REPOSITORIES_FILENAME
        is_default_gui_repos_file = True

    if gui_dir is None:
        gui_dir = project_root / "Gui"

    # Log file
    if log_file is None:
        log_file = script_dir / "log.txt"

    print(f"[*] Log file: {log_file}")
    results: Dict[str, bool] = {}

    # 1. Update Launcher
    if check_launcher:
        print("\n==============================")
        print("=== Checking Launcher Update ===")
        print("==============================")
        print(f"[*] Launcher directory: {launcher_dir}")
        print(f"[*] Launcher repositories file: {launcher_repositories_file}")
        effective_launcher_url = remote_launcher_repositories_url or (
            list_url(LAUNCHER_REPOSITORY_URL) if is_default_launcher_repos_file else None
        )
        launcher_results = update_repositories_group(
            repositories_file=launcher_repositories_file,
            target_base_dir=launcher_dir,
            remote_url=effective_launcher_url,
            log_file=log_file,
            is_single_component_dir=True,
            component_name="Launcher",
        )
        results.update(launcher_results)

    # 2. Update Gui
    if check_gui:
        print("\n=========================")
        print("=== Checking Gui Update ===")
        print("=========================")
        print(f"[*] Gui directory: {gui_dir}")
        print(f"[*] Gui repositories file: {gui_repositories_file}")
        effective_gui_url = remote_gui_repositories_url or (
            list_url(GUI_REPOSITORY_URL) if is_default_gui_repos_file else None
        )
        gui_results = update_repositories_group(
            repositories_file=gui_repositories_file,
            target_base_dir=gui_dir,
            remote_url=effective_gui_url,
            log_file=log_file,
            is_single_component_dir=True,
            component_name="Gui",
        )
        results.update(gui_results)

    # 3. Update Mods
    if check_mods:
        print("\n==========================")
        print("=== Checking Mods Update ===")
        print("==========================")
        print(f"[*] Mods directory: {mods_dir}")
        print(f"[*] Mods repositories file: {repositories_file}")
        effective_mods_url = remote_repositories_url or (
            list_url(REPOSITORIES_URL) if is_default_repos_file else None
        )
        mods_results = update_repositories_group(
            repositories_file=repositories_file,
            target_base_dir=mods_dir,
            remote_url=effective_mods_url,
            log_file=log_file,
            is_single_component_dir=False,
        )
        results.update(mods_results)

    # 4. Update the updater itself (last: the code of this run is already loaded)
    if check_updater:
        print("\n=============================")
        print("=== Checking Updater Update ===")
        print("=============================")
        is_default_updater_repos_file = updater_repositories_file is None
        if updater_repositories_file is None:
            updater_repositories_file = script_dir / DEFAULT_UPDATER_REPOSITORIES_FILENAME
        effective_updater_url = remote_updater_repositories_url or (
            list_url(UPDATER_REPOSITORY_URL) if is_default_updater_repos_file else None
        )
        updater_results = update_repositories_group(
            repositories_file=updater_repositories_file,
            target_base_dir=updater_dir or script_dir,
            remote_url=effective_updater_url,
            log_file=log_file,
            is_single_component_dir=True,
            component_name="Updater",
        )
        results.update(updater_results)

    print("\n=== All Update Checks Completed ===")
    for item_name, updated in results.items():
        status = "Updated" if updated else "No update needed / Up to date / Skipped"
        detail = SETTINGS.report.get(item_name, {}).get("status")
        print(f"- {item_name}: {status}" + (f" ({detail})" if detail else ""))
    print(summary_line(SETTINGS.report))

    return results


def summary_line(rep: Dict[str, dict]) -> str:
    """One line the Terminal's update window reads: counts by outcome."""
    counts: Dict[str, int] = {}
    for entry in rep.values():
        counts[entry["status"]] = counts.get(entry["status"], 0) + 1
    order = ["updated", "installed", "rolled-back", "available", "current", "newer-local", "held", "failed",
             "missing-dependency", "unreachable", "stopped", "unpublished", "declined", "absent"]
    parts = [f"{counts[k]} {k}" for k in order if counts.get(k)]
    return "[=] Summary: " + (", ".join(parts) if parts else "nothing to check")


def exit_code_for(rep: Dict[str, dict]) -> int:
    """0 every check ran, 1 a component failed, 2 nothing could be reached, 5 stopped by the user.

    A component the channel does not carry yet ("unpublished", a 404) is not a failure. A
    held mod is not checked at all (no network), so it says nothing about being offline.
    """
    statuses = [e["status"] for e in rep.values()]
    if "stopped" in statuses:
        return 5
    if "failed" in statuses or "missing-dependency" in statuses:
        return 1
    checked = [s for s in statuses if s not in ("absent", "unpublished", "declined", "held")]
    if checked and all(s == "unreachable" for s in checked):
        return 2
    if "unreachable" in statuses:
        return 1
    return 0


def write_run_report(path: Path, started: datetime.datetime, code: int) -> None:
    """Updater/last_run.json (or the --report path): the channel, when, the exit code and each component's outcome."""
    data = {
        "channel": SETTINGS.channel,
        "exact": SETTINGS.exact,
        "check_only": SETTINGS.check_only,
        "started": started.isoformat(timespec="seconds"),
        "finished": datetime.datetime.now().isoformat(timespec="seconds"),
        "exit_code": code,
        "components": SETTINGS.report,
    }
    try:
        path.write_text(json.dumps(data, indent=1), encoding="utf-8")
    except Exception as e:
        print(f"[!] Could not write {path}: {e}")


def main():
    parser = argparse.ArgumentParser(description="The Zenith Terminal Updater")
    parser.add_argument(
        "--repositories-file",
        "-r",
        type=Path,
        default=None,
        help="Path to mods repositories.txt (defaults to Updater/repositories.txt)",
    )
    parser.add_argument(
        "--mods-dir",
        "-m",
        type=Path,
        default=None,
        help="Path to Launcher/mods directory (defaults to Launcher/mods)",
    )
    parser.add_argument(
        "--remote-repositories-url",
        "-u",
        type=str,
        default=None,
        help="Remote URL for repositories.txt (defaults to REPOSITORIES_URL)",
    )
    parser.add_argument(
        "--launcher-repositories-file",
        type=Path,
        default=None,
        help="Path to launcher_repositories.txt (defaults to Updater/launcher_repositories.txt)",
    )
    parser.add_argument(
        "--launcher-dir",
        type=Path,
        default=None,
        help="Path to Launcher directory (defaults to Launcher)",
    )
    parser.add_argument(
        "--remote-launcher-repositories-url",
        type=str,
        default=None,
        help="Remote URL for launcher_repositories.txt (defaults to LAUNCHER_REPOSITORY_URL)",
    )
    parser.add_argument(
        "--gui-repositories-file",
        type=Path,
        default=None,
        help="Path to Gui_repositories.txt (defaults to Updater/Gui_repositories.txt)",
    )
    parser.add_argument(
        "--gui-dir",
        type=Path,
        default=None,
        help="Path to Gui directory (defaults to Gui)",
    )
    parser.add_argument(
        "--remote-gui-repositories-url",
        type=str,
        default=None,
        help="Remote URL for Gui_repositories.txt (defaults to GUI_REPOSITORY_URL)",
    )
    parser.add_argument(
        "--no-launcher",
        action="store_true",
        help="Skip Launcher update check",
    )
    parser.add_argument(
        "--no-gui",
        action="store_true",
        help="Skip Gui update check",
    )
    parser.add_argument(
        "--no-updater",
        action="store_true",
        help="Skip the updater's own update check",
    )
    parser.add_argument(
        "--no-mods",
        action="store_true",
        help="Skip mods update check",
    )
    parser.add_argument(
        "--log-file",
        "-l",
        type=Path,
        default=None,
        help="Path to log.txt file (defaults to Updater/log.txt)",
    )
    parser.add_argument(
        "--channel",
        type=str,
        default=None,
        help="Update channel (defaults to Updater/channel.txt, else stable)",
    )
    parser.add_argument(
        "--exact",
        action="store_true",
        default=None,
        help="Match the channel exactly, older or newer (defaults to channel.txt's 'exact')",
    )
    parser.add_argument(
        "--install-new",
        action="store_true",
        default=None,
        help="Also install listed mods that are not present (not ones in Updater/declined.txt)",
    )
    parser.add_argument(
        "--token-file",
        type=Path,
        default=None,
        help="File holding a GitHub token, for a private source (defaults to channel.txt's 'token-file')",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only report what would change (written to last_run.json, or --report); change nothing",
    )
    parser.add_argument(
        "--no-pin",
        action="store_true",
        help="Read GitHub files at the branch address instead of its current commit (may be up to 5 minutes old)",
    )
    parser.add_argument(
        "--rollback",
        metavar="NAME",
        type=str,
        default=None,
        help="Put back the version mod NAME had before its last update, and hold it there (Updater/held.txt); no network",
    )
    parser.add_argument(
        "--report",
        metavar="PATH",
        type=Path,
        default=None,
        help="Write the run report to PATH instead of Updater/last_run.json",
    )
    args = parser.parse_args()

    global SETTINGS
    script_dir = Path(__file__).resolve().parent
    started = datetime.datetime.now()
    report_path = args.report or script_dir / "last_run.json"

    if args.rollback:
        SETTINGS = RunSettings()
        SETTINGS.channel = (args.channel or read_channel_file(script_dir / CHANNEL_FILENAME).get("channel")
                            or DEFAULT_CHANNEL).strip().lower()
        mods_dir = args.mods_dir or script_dir.parent / "Launcher" / "mods"
        ok = rollback_mod(args.rollback.strip(), mods_dir, script_dir / "rollback",
                          state_dir=script_dir / "state", held_file=script_dir / HELD_FILENAME)
        code = 0 if ok else 1
        write_run_report(report_path, started, code)
        return code

    token = None
    if args.token_file is not None and args.token_file.is_file():
        token = args.token_file.read_text(encoding="utf-8").strip() or None

    run_updater(
        repositories_file=args.repositories_file,
        mods_dir=args.mods_dir,
        remote_repositories_url=args.remote_repositories_url,
        launcher_repositories_file=args.launcher_repositories_file,
        launcher_dir=args.launcher_dir,
        remote_launcher_repositories_url=args.remote_launcher_repositories_url,
        gui_repositories_file=args.gui_repositories_file,
        gui_dir=args.gui_dir,
        remote_gui_repositories_url=args.remote_gui_repositories_url,
        check_launcher=not args.no_launcher,
        check_gui=not args.no_gui,
        check_mods=not args.no_mods,
        log_file=args.log_file,
        channel=args.channel,
        exact=args.exact,
        install_new=args.install_new,
        token=token,
        pin_commits=not args.no_pin,
        check_only=args.check,
        work_dir=script_dir / "_work",
        state_dir=script_dir / "state",
        check_updater=not args.no_updater,
        rollback_dir=script_dir / "rollback",
    )
    code = exit_code_for(SETTINGS.report)
    write_run_report(report_path, started, code)
    return code


if __name__ == "__main__":
    sys.exit(main())
