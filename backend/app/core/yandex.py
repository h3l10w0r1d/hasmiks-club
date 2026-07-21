import requests

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def resolve_map_url(url: str | None) -> str | None:
    """Expand a Yandex Maps share link into one carrying ll/z coordinates.

    Short links (yandex.*/maps/-/xxxx, typically from the mobile "Share"
    button) 301-redirect to the full map URL with coordinates in the query
    string; our iframe embed needs those coordinates. Uses `requests`
    specifically — Yandex's bot detection 403s httpx's request even with a
    browser User-Agent and HTTP/1.1 forced, but lets requests/urllib3
    through, so this isn't a fingerprint we can just paper over with headers.
    Best-effort: any network failure just keeps the original URL so saving
    an event never depends on Yandex being reachable.
    """
    if not url or "yandex." not in url or "ll=" in url:
        return url
    try:
        resp = requests.head(
            url, allow_redirects=True, timeout=3.0, headers={"User-Agent": _BROWSER_UA},
        )
        return resp.url
    except requests.RequestException:
        return url
