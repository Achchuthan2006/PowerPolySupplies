#!/usr/bin/env python3
"""Audit and optionally optimize frontend asset images.

Examples:
  python scripts/optimize_images.py
  python scripts/optimize_images.py --write
  python scripts/optimize_images.py --write --max-kb 100 --quality 78
"""

from __future__ import annotations

import argparse
import io
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image

    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class ImageStats:
    path: Path
    bytes_before: int
    bytes_after: int
    optimized: bool
    skipped_reason: str = ""

    @property
    def kb_before(self) -> float:
        return self.bytes_before / 1024.0

    @property
    def kb_after(self) -> float:
        return self.bytes_after / 1024.0

    @property
    def saved_bytes(self) -> int:
        return max(0, self.bytes_before - self.bytes_after)


def list_images(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            yield p


def optimize_with_pillow(path: Path, quality: int, max_width: int, max_height: int) -> bytes | None:
    with Image.open(path) as img:
        original_mode = img.mode
        width, height = img.size

        scale = min(1.0, max_width / width if width else 1.0, max_height / height if height else 1.0)
        if scale < 1.0:
            new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
            img = img.resize(new_size, Image.LANCZOS)

        ext = path.suffix.lower()
        save_args: dict[str, object] = {"optimize": True}
        output = io.BytesIO()

        if ext in {".jpg", ".jpeg"}:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            save_args.update({"format": "JPEG", "quality": quality, "progressive": True})
        elif ext == ".png":
            if img.mode == "P":
                img = img.convert("RGBA")
            save_args.update({"format": "PNG", "compress_level": 9})
        elif ext == ".webp":
            if original_mode in ("RGBA", "LA") or ("transparency" in img.info):
                save_args.update({"format": "WEBP", "quality": quality, "method": 6})
            else:
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                save_args.update({"format": "WEBP", "quality": quality, "method": 6})
        else:
            return None

        img.save(output, **save_args)
        return output.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit/optimize image assets.")
    parser.add_argument("--root", default="frontend/assets", help="Assets directory (default: frontend/assets)")
    parser.add_argument("--max-kb", type=int, default=120, help="Target max size in KB (default: 120)")
    parser.add_argument("--quality", type=int, default=80, help="JPEG/WEBP quality (default: 80)")
    parser.add_argument("--max-width", type=int, default=1920, help="Max output width (default: 1920)")
    parser.add_argument("--max-height", type=int, default=1920, help="Max output height (default: 1920)")
    parser.add_argument("--write", action="store_true", help="Apply changes in-place")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    root = repo_root / args.root if not Path(args.root).is_absolute() else Path(args.root)

    if not root.exists():
        print(f"ERROR: directory not found: {root}")
        return 2

    images = sorted(list_images(root))
    if not images:
        print(f"No images found under {root}")
        return 0

    stats: list[ImageStats] = []
    target_bytes = args.max_kb * 1024

    for img_path in images:
        before = img_path.stat().st_size

        if not PIL_AVAILABLE:
            stats.append(ImageStats(img_path, before, before, optimized=False, skipped_reason="Pillow not installed"))
            continue

        should_optimize = before > target_bytes
        if not should_optimize:
            stats.append(ImageStats(img_path, before, before, optimized=False, skipped_reason="Already <= target"))
            continue

        try:
            optimized_bytes = optimize_with_pillow(
                img_path,
                quality=args.quality,
                max_width=args.max_width,
                max_height=args.max_height,
            )
            if not optimized_bytes:
                stats.append(ImageStats(img_path, before, before, optimized=False, skipped_reason="Unsupported format"))
                continue

            after = len(optimized_bytes)
            if after >= before:
                stats.append(ImageStats(img_path, before, before, optimized=False, skipped_reason="No size reduction"))
                continue

            if args.write:
                img_path.write_bytes(optimized_bytes)
            stats.append(ImageStats(img_path, before, after, optimized=True))
        except Exception as exc:
            stats.append(ImageStats(img_path, before, before, optimized=False, skipped_reason=f"Error: {exc}"))

    total_before = sum(s.bytes_before for s in stats)
    total_after = sum(s.bytes_after for s in stats)
    saved = max(0, total_before - total_after)
    optimized_count = sum(1 for s in stats if s.optimized)
    over_target = sum(1 for s in stats if s.bytes_after > target_bytes)

    print(f"Scanned: {len(stats)} images in {root}")
    print(f"Mode: {'WRITE' if args.write else 'DRY-RUN'}")
    print(f"Pillow available: {'yes' if PIL_AVAILABLE else 'no'}")
    print(f"Target max size: {args.max_kb} KB")
    print(f"Optimized candidates: {optimized_count}")
    print(f"Still over target: {over_target}")
    print(f"Total size before: {total_before / 1024:.1f} KB")
    print(f"Total size after : {total_after / 1024:.1f} KB")
    print(f"Total saved      : {saved / 1024:.1f} KB")

    top = sorted(stats, key=lambda s: s.saved_bytes, reverse=True)[:10]
    if top:
        print("\nTop savings:")
        for s in top:
            rel = s.path.relative_to(repo_root)
            if s.saved_bytes > 0:
                print(f"- {rel}: {s.kb_before:.1f} KB -> {s.kb_after:.1f} KB (saved {s.saved_bytes / 1024:.1f} KB)")

    if not PIL_AVAILABLE:
        print("\nTip: install Pillow to enable optimization:")
        print("  pip install pillow")
        return 0

    if not args.write:
        print("\nDry-run complete. Use --write to apply optimization.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
