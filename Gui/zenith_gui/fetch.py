"""A mod's zip fetched from a GitHub address the person copied.

This is the whole of the window's downloading, kept to one function so that the loader's own updater can take its
place when it exists: `download(url, dest)` writes one zip and nothing else. What may be fetched is narrow on
purpose: https, github.com, a release file or a repository's archive, a zip, no larger than MOST. A redirect is
followed only to GitHub's own file hosts. The zip is then added the same way as one chosen from the disk.
"""
import re
import urllib.error
import urllib.parse
import urllib.request

MOST = 1 << 30                      # bytes: larger than any mod so far, small enough to refuse a wrong file
FIRST = ("github.com", "www.github.com")
AFTER = FIRST + ("codeload.github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com")
_PATH = re.compile(r"/[\w.-]+/[\w.-]+/(?:releases/download/[^/]+/[^/]+\.zip|releases/latest/download/[^/]+\.zip"
                   r"|archive/refs/(?:tags|heads)/[^?#]+\.zip|archive/[^/]+\.zip)")


class FetchError(Exception):
    """the text is for the person"""


def address(text):
    """The copied text as an address this module fetches, or "" when it is not one."""
    text = str(text or "").strip()
    if len(text) > 500 or re.search(r"\s", text): return ""
    parts = urllib.parse.urlsplit(text)
    if parts.scheme != "https" or parts.username or parts.port or (parts.hostname or "").lower() not in FIRST: return ""
    if not _PATH.fullmatch(parts.path): return ""
    return urllib.parse.urlunsplit(("https", "github.com", parts.path, "", ""))


def file_name(url):
    return urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1])


def follows(url):
    """may a redirect lead here"""
    parts = urllib.parse.urlsplit(url)
    return parts.scheme == "https" and not parts.username and (parts.hostname or "").lower() in AFTER


class _Narrow(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not follows(newurl): raise FetchError("the address leads away from GitHub")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _open(url):
    opener = urllib.request.build_opener(_Narrow)
    return opener.open(urllib.request.Request(url, headers={"User-Agent": "ZenithTerminal"}), timeout=30)


def download(url, dest, progress=None, most=MOST, open_url=_open):
    """`url` (one `address` returned) written to `dest`. progress(done, total) is called as it arrives; total is 0
    when the host does not say. Raises FetchError with words for the person; `dest` is the caller's to remove."""
    if not address(url): raise FetchError("not a GitHub release or archive zip")
    try:
        with open_url(url) as response:
            total = int(response.headers.get("Content-Length") or 0)
            if total > most: raise FetchError("the file is larger than %d MB" % (most >> 20))
            done = 0
            with open(dest, "wb") as out:
                while True:
                    block = response.read(1 << 18)
                    if not block: break
                    done += len(block)
                    if done > most: raise FetchError("the file is larger than %d MB" % (most >> 20))
                    out.write(block)
                    if progress: progress(done, total)
            if total and done != total: raise FetchError("the download stopped early")
            return done
    except urllib.error.HTTPError as error:
        raise FetchError("GitHub has no file at that address" if error.code == 404 else "GitHub answered %d" % error.code)
    except (urllib.error.URLError, OSError, ValueError) as error:
        raise FetchError("no connection, or it was lost (%s)" % getattr(error, "reason", error))
