from typing import Any
from sqlalchemy.orm import DeclarativeBase, declared_attr


class Base(DeclarativeBase):
    id: Any
    __name__: str

    # Generate __tablename__ automatically from lowercase class name
    @declared_attr.directive
    def __tablename__(cls) -> str:
        # e.g., ProviderService -> provider_services, or User -> users
        name = cls.__name__.lower()
        if not name.endswith("s"):
            return f"{name}s"
        return name
