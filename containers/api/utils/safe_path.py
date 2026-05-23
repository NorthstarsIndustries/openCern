"""
Path-safety helpers.

`safe_join` resolves a user-supplied path under a trusted base directory and
refuses anything that would escape it (via `..`, absolute paths, or symlinks).
Use it any time a request value flows into a filesystem operation.
"""
import os
from typing import Optional


class UnsafePathError(ValueError):
    """Raised when a user-supplied path would escape the allowed base directory."""


def safe_join(base: str, *parts: str) -> str:
    """Join `parts` under `base`, refusing any path that escapes `base`.

    Returns the absolute, resolved path. Raises UnsafePathError if the result
    is not contained within the resolved base (covers `..`, absolute injection,
    and symlink escapes).
    """
    if not parts:
        raise UnsafePathError("empty path")

    for p in parts:
        if not isinstance(p, str) or "\x00" in p:
            raise UnsafePathError("invalid path component")

    base_resolved = os.path.realpath(base)
    candidate = os.path.realpath(os.path.join(base_resolved, *parts))

    try:
        common = os.path.commonpath([base_resolved, candidate])
    except ValueError:
        raise UnsafePathError("path outside allowed directory")

    if common != base_resolved:
        raise UnsafePathError("path outside allowed directory")

    return candidate


def safe_join_or_none(base: str, *parts: str) -> Optional[str]:
    """Same as safe_join but returns None instead of raising."""
    try:
        return safe_join(base, *parts)
    except UnsafePathError:
        return None
