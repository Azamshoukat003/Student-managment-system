"""GPS geofence logic (spec §9): Haversine distance + radius/accuracy checks."""
import math
from typing import Optional

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lng points, in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def check_geofence(
    student_lat: float,
    student_lon: float,
    accuracy: Optional[float],
    session_lat: float,
    session_lon: float,
    allowed_radius_m: float,
    max_accuracy_m: float,
) -> dict:
    """Evaluate a student's location against a session's geofence.

    Returns distance, and booleans for accuracy/radius, plus overall pass + reason.
    """
    distance = haversine_m(student_lat, student_lon, session_lat, session_lon)
    accuracy_ok = accuracy is not None and accuracy <= max_accuracy_m
    within_radius = distance <= allowed_radius_m

    # Even the closest point of the accuracy circle is outside the radius:
    # you're definitely outside, so say that instead of complaining about accuracy.
    margin = accuracy if accuracy is not None else 0.0
    definitely_outside = (distance - margin) > allowed_radius_m

    if definitely_outside:
        reason = f"You are ~{round(distance)}m away — outside the {round(allowed_radius_m)}m allowed radius."
    elif not accuracy_ok:
        reason = (
            f"GPS accuracy too low (±{round(accuracy)}m). Move to an open area and retry."
            if accuracy is not None
            else "GPS accuracy is unknown. Please retry."
        )
    elif not within_radius:
        reason = f"You are {round(distance)}m away — outside the {round(allowed_radius_m)}m allowed radius."
    else:
        reason = "Inside the allowed area."

    return {
        "distance": round(distance, 1),
        "accuracy_ok": accuracy_ok,
        "within_radius": within_radius,
        "passed": accuracy_ok and within_radius,
        "reason": reason,
    }
