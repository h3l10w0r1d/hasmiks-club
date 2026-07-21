import httpx


def resolve_map_url(url: str | None) -> str | None:
    """Expand a Yandex Maps share link into one carrying ll/z coordinates.

    Short links (yandex.*/maps/-/xxxx, typically from the mobile "Share"
    button) 301-redirect to the full map URL with coordinates in the query
    string; our iframe embed needs those coordinates. Best-effort: any
    network failure just keeps the original URL so saving an event never
    depends on Yandex being reachable.
    """
    if not url or "yandex." not in url or "ll=" in url:
        return url
    try:
        with httpx.Client(follow_redirects=True, timeout=3.0) as client:
            resp = client.head(url)
            return str(resp.url)
    except httpx.HTTPError:
        return url
