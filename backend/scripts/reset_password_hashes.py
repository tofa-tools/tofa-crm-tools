"""
One-off script to print bcrypt hashes for known passwords.
Run from repo root: python -m backend.scripts.reset_password_hashes
Use the output to UPDATE production users if login fails after deploy (e.g. DB mismatch).
"""
import sys
import os

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.core.auth import get_password_hash

PASSWORDS = [
    ("admin@tofa.com", "admin123"),
    ("coach@tofa.com", "coach123"),
]

def main():
    # Table name is "user" (quoted) in PostgreSQL schema
    print("-- Run these in your production DB (e.g. Supabase SQL Editor):\n")
    for email, plain in PASSWORDS:
        h = get_password_hash(plain)
        print(f'UPDATE "user" SET hashed_password = \'{h}\' WHERE email = \'{email}\';')
    print("\n-- Then try logging in again with the same email and password.")

if __name__ == "__main__":
    main()
