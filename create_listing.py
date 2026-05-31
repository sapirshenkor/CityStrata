#!/usr/bin/env python3
"""Create random apartment listings via POST /api/property-listings."""

from __future__ import annotations

import json
import random
import sys
import time
import urllib.error
import urllib.request
from typing import Any

API_BASE = "http://localhost:8000"
LISTINGS_COUNT = 200

# Neighborhoods and streets in Eilat (representative sample)
LOCATIONS: dict[str, list[str]] = {
    "אופיר": ["ארגמן", "גרופית", "לוס אנגלס", "שחורת", "קידר"],
    "אזור תעשייה ישן": ["האומן", "הבנאי", "החרש", "הנגר", "המסגר"],
    "מרכז העיר": ["אלמוגים", "גן בנימין", "רתמים", "אפעה"],
    "גנים א": ["האירוס", "הברוש", "חצב", "סביון", "צאלון"],
    "גנים ב": ["ברקן", "לוטוס", "יסמין", "רקפת", "דולב"],
    "שחמון - רובע 9": ["רחל אימנו", "שרה אימנו", "מור", "קינמון", "אסתר המלכה"],
    "שחמון - רובע 6": ["דפנה", "דרך הבשמים", "יצחק אבינו", "משה רבנו"],
    "יעלים": ["יעלים", "חורב", "המלחה", "השחם", "ברדלס"],
    "ערבה": ["סיני", "קדש", "פארן", "צופר", "ערד"],
}

RENTAL_PERIODS = ["חצי שנה", "שנה", "גמיש", "טווח ארוך"]

# Nominatim usage policy: ~1 request/second when geocoding via the API.
GEOCODE_DELAY_SECONDS = 1.1


def generate_apartment_payload() -> dict[str, Any]:
    neighborhood = random.choice(list(LOCATIONS.keys()))
    street = random.choice(LOCATIONS[neighborhood])
    total_floors = random.randint(1, 12)
    unit_floor = random.randint(0, total_floors)
    rooms = random.choice([2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0])

    return {
        "property_type": "apartment",
        "city": "אילת",
        "street": street,
        "house_number": str(random.randint(1, 150)),
        "neighborhood": neighborhood,
        "total_floors": total_floors,
        "parking_spots": random.randint(0, 3),
        # Omit latitude/longitude — the API geocodes from street + house_number + city.
        "publisher_name": f"משתמש {random.randint(1000, 9999)}",
        "phone_number": f"05{random.randint(0, 9)}{random.randint(1000000, 9999999)}",
        "units": [
            {
                "floor": unit_floor,
                "rooms": rooms,
                "bathrooms": random.randint(1, 3),
                "has_accessibility": random.choice([True, False]),
                "has_ac": True,
                "has_bars": random.choice([True, False]),
                "has_solar_heater": random.choice([True, False]),
                "has_elevator": random.choice([True, False]) if total_floors > 1 else False,
                "is_for_roommates": random.choice([True, False]),
                "is_furnished": random.choice([True, False]),
                "is_kosher_kitchen": random.choice([True, False]),
                "allows_pets": random.choice([True, False]),
                "is_renovated": random.choice([True, False]),
                "has_mamad": random.choice([True, False]),
                "has_mamak": random.choice([True, False]),
                "has_building_shelter": random.choice([True, False]),
                "has_storage": random.choice([True, False]),
                "built_sqm": random.randint(45, 180),
                "monthly_price": random.randint(3000, 12000),
                "rental_period": random.choice(RENTAL_PERIODS),
                "is_occupied": False,
                "description": f"דירה בשכונת {neighborhood}, {rooms} חדרים.",
            }
        ],
    }


def post_listing(payload: dict[str, Any]) -> tuple[int, dict[str, Any] | str]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{API_BASE}/api/property-listings",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(detail)
        except json.JSONDecodeError:
            parsed = detail
        return exc.code, parsed


def main() -> int:
    print(
        f"Creating {LISTINGS_COUNT} apartment listings at {API_BASE}/api/property-listings "
        f"(coordinates resolved by API geocoding from address)..."
    )
    print(f"Estimated runtime: ~{int(LISTINGS_COUNT * GEOCODE_DELAY_SECONDS / 60)} minutes.\n")

    created = 0
    failed = 0
    listing_ids: list[str] = []
    results: list[dict[str, Any]] = []

    for index in range(1, LISTINGS_COUNT + 1):
        payload = generate_apartment_payload()
        status, result = post_listing(payload)

        if status == 201 and isinstance(result, dict):
            created += 1
            listing_id = result.get("id", "")
            listing_ids.append(listing_id)
            lat = result.get("latitude")
            lon = result.get("longitude")
            results.append(
                {
                    "id": listing_id,
                    "address": f"{payload['street']} {payload['house_number']}, {payload['city']}",
                    "neighborhood": payload["neighborhood"],
                    "latitude": lat,
                    "longitude": lon,
                }
            )
            print(
                f"[{index}/{LISTINGS_COUNT}] OK  {listing_id}  "
                f"{payload['street']} {payload['house_number']} → ({lat}, {lon})"
            )
        else:
            failed += 1
            print(
                f"[{index}/{LISTINGS_COUNT}] FAIL ({status})  "
                f"{payload['street']} {payload['house_number']}: {result}",
                file=sys.stderr,
            )

        if index < LISTINGS_COUNT:
            time.sleep(GEOCODE_DELAY_SECONDS)

    summary_path = "eilat_200_created_listings.json"
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "created_count": created,
                "failed_count": failed,
                "listing_ids": listing_ids,
                "listings": results,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\nDone: {created} created, {failed} failed.")
    print(f"Listing IDs saved to {summary_path}.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
