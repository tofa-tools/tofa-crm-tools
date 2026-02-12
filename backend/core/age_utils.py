"""Age utilities - compute age from date of birth."""
from datetime import date, datetime
from typing import Optional


def calculate_age(dob: Optional[date]) -> Optional[int]:
    """Compute age from date of birth. Returns current year - birth year."""
    if not dob:
        return None
    today = date.today()
    age = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        age -= 1
    return age if age >= 0 else None
