from __future__ import annotations

import base64
import io
from typing import Optional

from PIL import Image


def normalize_avatar_or_lot_image(base64_payload: Optional[str]) -> Optional[str]:
    """
    Требование:
    - 128x128
    - JPEG, quality=70
    - хранить как base64 (без data:image/... префикса)

    На вход можно дать:
    - чистый base64
    - data:image/...;base64,<payload>
    """
    if not base64_payload:
        return None

    payload = base64_payload.strip()
    if payload.startswith("data:"):
        # data:image/png;base64,....
        comma = payload.find(",")
        if comma != -1:
            payload = payload[comma + 1 :]

    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception:
        return None

    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return None

    img = img.resize((128, 128), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=70, optimize=True)
    return base64.b64encode(out.getvalue()).decode("ascii")
