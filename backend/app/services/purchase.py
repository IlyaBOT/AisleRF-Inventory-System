from __future__ import annotations

from urllib.parse import urlparse


def purchase_label(url: str | None) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return "Купить"

    if "ozon." in host:
        return "Купить на OZON"
    if "aliexpress." in host or "ali." in host:
        return "Купить на AliExpress"
    if "wildberries." in host or "wb." in host:
        return "Купить на Wildberries"
    if "amazon." in host:
        return "Купить на Amazon"
    if "ebay." in host:
        return "Купить на eBay"
    return "Купить"
