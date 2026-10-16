import getpass
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def main() -> int:
    email = settings.FIRST_SUPERUSER_EMAIL.strip().lower()
    password = getpass.getpass("New password for configured administrator: ")
    confirmation = getpass.getpass("Confirm new password: ")

    if len(password) < 8:
        print("Password must contain at least 8 characters.", file=sys.stderr)
        return 1
    if password != confirmation:
        print("Passwords do not match.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        admin = db.query(User).filter(
            User.email == email,
            User.role == UserRole.ADMIN,
        ).first()
        if not admin:
            print("Configured administrator account was not found. Start the backend once, then retry.", file=sys.stderr)
            return 1

        admin.hashed_password = get_password_hash(password)
        db.commit()
        print("Administrator password updated.")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
