#!/usr/bin/env python3
"""Validate product data quality for frontend/data/products.json.

Usage:
  python scripts/validate_products.py
  python scripts/validate_products.py --file frontend/data/products.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote


REQUIRED_FIELDS = ("id", "name", "slug", "category", "priceCents", "currency", "stock", "image")
MOJIBAKE_HINTS = ("Ã", "â", "�", "Ð", "Ñ", "à¤", "à®", "ì")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def looks_like_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def normalize_image_path(raw_path: str, repo_root: Path) -> Path:
    cleaned = raw_path.replace("\\", "/")
    cleaned = unquote(cleaned)
    if cleaned.startswith("./"):
        cleaned = cleaned[2:]
    if cleaned.startswith("/"):
        cleaned = cleaned[1:]
    return repo_root / "frontend" / cleaned


def type_name(value: Any) -> str:
    return type(value).__name__


def validate_products(data: Any, repo_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, list):
        return (["Top-level JSON must be an array of product objects."], warnings)

    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()

    for index, product in enumerate(data):
        row = f"item[{index}]"
        if not isinstance(product, dict):
            errors.append(f"{row}: expected object, got {type_name(product)}")
            continue

        for field in REQUIRED_FIELDS:
            if field not in product:
                errors.append(f"{row}: missing required field '{field}'")

        product_id = product.get("id")
        if isinstance(product_id, str):
            product_id = product_id.strip()
            if not product_id:
                errors.append(f"{row}: 'id' is empty")
            elif product_id in seen_ids:
                errors.append(f"{row}: duplicate id '{product_id}'")
            else:
                seen_ids.add(product_id)
        else:
            errors.append(f"{row}: 'id' must be string, got {type_name(product_id)}")

        slug = product.get("slug")
        if isinstance(slug, str):
            slug = slug.strip()
            if not slug:
                errors.append(f"{row}: 'slug' is empty")
            else:
                if slug in seen_slugs:
                    errors.append(f"{row}: duplicate slug '{slug}'")
                else:
                    seen_slugs.add(slug)
                if not SLUG_PATTERN.match(slug):
                    warnings.append(f"{row}: slug '{slug}' is not kebab-case")
        else:
            errors.append(f"{row}: 'slug' must be string, got {type_name(slug)}")

        name = product.get("name")
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{row}: 'name' must be non-empty string")
        elif re.search(r'(^|[^0-9])(40|54|60)"', name):
            warnings.append(f'{row}: name contains size 40/54/60: "{name}"')

        category = product.get("category")
        if not isinstance(category, str) or not category.strip():
            errors.append(f"{row}: 'category' must be non-empty string")

        currency = product.get("currency")
        if not isinstance(currency, str) or not currency.strip():
            errors.append(f"{row}: 'currency' must be non-empty string")
        elif currency.strip().upper() != currency.strip():
            warnings.append(f"{row}: currency '{currency}' should be uppercase (e.g. CAD)")

        price = product.get("priceCents")
        if not isinstance(price, int):
            errors.append(f"{row}: 'priceCents' must be integer, got {type_name(price)}")
        elif price < 0:
            errors.append(f"{row}: 'priceCents' cannot be negative")

        stock = product.get("stock")
        if not isinstance(stock, int):
            errors.append(f"{row}: 'stock' must be integer, got {type_name(stock)}")
        elif stock < 0:
            errors.append(f"{row}: 'stock' cannot be negative")

        image = product.get("image")
        if not isinstance(image, str) or not image.strip():
            errors.append(f"{row}: 'image' must be non-empty string")
        elif not looks_like_url(image):
            expected = normalize_image_path(image, repo_root)
            if not expected.exists():
                warnings.append(f"{row}: image file not found -> {image}")

        images = product.get("images")
        if images is not None:
            if not isinstance(images, list):
                errors.append(f"{row}: 'images' must be an array when present")
            else:
                for i, image_path in enumerate(images):
                    if not isinstance(image_path, str) or not image_path.strip():
                        errors.append(f"{row}: images[{i}] must be non-empty string")
                        continue
                    if not looks_like_url(image_path):
                        expected = normalize_image_path(image_path, repo_root)
                        if not expected.exists():
                            warnings.append(f"{row}: images[{i}] file not found -> {image_path}")

        for key, value in product.items():
            if isinstance(value, str) and any(hint in value for hint in MOJIBAKE_HINTS):
                warnings.append(f"{row}: '{key}' may have encoding issues")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate frontend product data file.")
    parser.add_argument(
        "--file",
        default="frontend/data/products.json",
        help="Path to products JSON file (default: frontend/data/products.json)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    target = (repo_root / args.file).resolve() if not Path(args.file).is_absolute() else Path(args.file)

    if not target.exists():
        print(f"ERROR: file not found: {target}")
        return 2

    try:
        raw = target.read_text(encoding="utf-8")
        data = json.loads(raw)
    except UnicodeDecodeError as exc:
        print(f"ERROR: failed to decode as UTF-8: {exc}")
        return 2
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")
        return 2

    errors, warnings = validate_products(data, repo_root)

    print(f"Validated file: {target}")
    print(f"Products: {len(data) if isinstance(data, list) else 0}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    if warnings:
        print("\nWarnings:")
        for item in warnings:
            print(f"- {item}")

    if errors:
        print("\nErrors:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("\nValidation passed with no blocking errors.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
