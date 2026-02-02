"""
Core Application Configuration and Dependency Injection.
Implements production-ready patterns for scalability.
"""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from functools import lru_cache
from enum import Enum
import os
import logging
from pathlib import Path


# =============================================================================
# ENVIRONMENT SETTINGS
# =============================================================================


class Environment(Enum):
    """Application environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


@dataclass
class Settings:
    """
    Application settings with validation and defaults.
    Loaded from environment variables with fallbacks.
    """

    # Environment
    environment: Environment = field(
        default_factory=lambda: Environment(os.getenv("ENVIRONMENT", "development"))
    )
    debug: bool = field(
        default_factory=lambda: os.getenv("DEBUG", "true").lower() == "true"
    )

    # Server
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    workers: int = field(default_factory=lambda: int(os.getenv("WORKERS", "4")))

    # AI Configuration
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    )
    gemini_temperature: float = field(
        default_factory=lambda: float(os.getenv("GEMINI_TEMPERATURE", "0.7"))
    )
    max_tokens: int = field(
        default_factory=lambda: int(os.getenv("MAX_TOKENS", "8192"))
    )

    # Code Execution
    code_execution_timeout: int = field(
        default_factory=lambda: int(os.getenv("CODE_EXECUTION_TIMEOUT", "30"))
    )
    max_output_size: int = field(
        default_factory=lambda: int(os.getenv("MAX_OUTPUT_SIZE", "100000"))
    )
    max_plot_count: int = field(
        default_factory=lambda: int(os.getenv("MAX_PLOT_COUNT", "10"))
    )

    # Session Management
    session_expiry_hours: int = field(
        default_factory=lambda: int(os.getenv("SESSION_EXPIRY_HOURS", "24"))
    )
    max_sessions: int = field(
        default_factory=lambda: int(os.getenv("MAX_SESSIONS", "1000"))
    )

    # File Handling
    max_file_size_mb: int = field(
        default_factory=lambda: int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    )
    upload_dir: Path = field(
        default_factory=lambda: Path(os.getenv("UPLOAD_DIR", "./uploads"))
    )
    allowed_extensions: List[str] = field(
        default_factory=lambda: ["csv", "xlsx", "xls", "json", "parquet"]
    )

    # Database
    database_url: Optional[str] = field(
        default_factory=lambda: os.getenv("DATABASE_URL")
    )
    redis_url: Optional[str] = field(default_factory=lambda: os.getenv("REDIS_URL"))

    # Rate Limiting
    rate_limit_enabled: bool = field(
        default_factory=lambda: os.getenv("RATE_LIMIT_ENABLED", "true").lower()
        == "true"
    )
    rate_limit_requests: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    )
    rate_limit_period: int = field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_PERIOD", "60"))
    )

    # CORS
    cors_origins: List[str] = field(
        default_factory=lambda: os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
        ).split(",")
    )

    # Logging
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    log_format: str = field(
        default_factory=lambda: os.getenv(
            "LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    )

    def __post_init__(self):
        """Validate settings after initialization."""
        if not self.gemini_api_key:
            logging.warning("GEMINI_API_KEY not set. AI features will be disabled.")

        # Ensure upload directory exists
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # Configure logging
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper()), format=self.log_format
        )

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()


# =============================================================================
# DEPENDENCY INJECTION CONTAINER
# =============================================================================


class Container:
    """
    Simple dependency injection container.
    Manages singleton instances of services.
    """

    _instances: Dict[str, Any] = {}
    _factories: Dict[str, callable] = {}

    @classmethod
    def register(cls, name: str, factory: callable):
        """Register a factory function for a service."""
        cls._factories[name] = factory

    @classmethod
    def get(cls, name: str) -> Any:
        """Get or create a service instance."""
        if name not in cls._instances:
            if name not in cls._factories:
                raise ValueError(f"Service '{name}' not registered")
            cls._instances[name] = cls._factories[name]()
        return cls._instances[name]

    @classmethod
    def reset(cls):
        """Reset all instances (useful for testing)."""
        cls._instances.clear()


# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================


def setup_logging(settings: Settings = None):
    """Configure application logging."""
    settings = settings or get_settings()

    # Create logger
    logger = logging.getLogger("datascienceai")
    logger.setLevel(getattr(logging, settings.log_level.upper()))

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(settings.log_format))
    logger.addHandler(console_handler)

    # File handler in production
    if settings.is_production:
        file_handler = logging.FileHandler("app.log")
        file_handler.setFormatter(logging.Formatter(settings.log_format))
        logger.addHandler(file_handler)

    return logger


# =============================================================================
# CACHE MANAGER
# =============================================================================


class CacheManager:
    """
    Simple in-memory cache with TTL support.
    Can be extended to use Redis in production.
    """

    def __init__(self, default_ttl: int = 300):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        import time

        if key in self._cache:
            entry = self._cache[key]
            if entry["expires_at"] > time.time():
                return entry["value"]
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache."""
        import time

        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + (ttl or self.default_ttl),
        }

    def delete(self, key: str):
        """Delete value from cache."""
        self._cache.pop(key, None)

    def clear(self):
        """Clear all cache."""
        self._cache.clear()

    def cleanup(self):
        """Remove expired entries."""
        import time

        current_time = time.time()
        expired_keys = [
            key
            for key, entry in self._cache.items()
            if entry["expires_at"] <= current_time
        ]
        for key in expired_keys:
            del self._cache[key]


# =============================================================================
# RATE LIMITER
# =============================================================================


class RateLimiter:
    """
    Token bucket rate limiter.
    """

    def __init__(self, requests: int = 100, period: int = 60):
        self.requests = requests
        self.period = period
        self._buckets: Dict[str, Dict[str, Any]] = {}

    def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed."""
        import time

        current_time = time.time()

        if identifier not in self._buckets:
            self._buckets[identifier] = {
                "tokens": self.requests - 1,
                "last_update": current_time,
            }
            return True

        bucket = self._buckets[identifier]
        elapsed = current_time - bucket["last_update"]

        # Refill tokens
        refill = int(elapsed * self.requests / self.period)
        bucket["tokens"] = min(self.requests, bucket["tokens"] + refill)
        bucket["last_update"] = current_time

        if bucket["tokens"] > 0:
            bucket["tokens"] -= 1
            return True

        return False

    def get_retry_after(self, identifier: str) -> int:
        """Get seconds until next allowed request."""
        if identifier not in self._buckets:
            return 0

        bucket = self._buckets[identifier]
        if bucket["tokens"] > 0:
            return 0

        return int(self.period / self.requests)


# =============================================================================
# ERROR HANDLING
# =============================================================================


class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        code: str = "ERROR",
        status_code: int = 500,
        details: Dict = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class ValidationError(AppError):
    """Validation error."""

    def __init__(self, message: str, field: str = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400,
            details={"field": field} if field else {},
        )


class NotFoundError(AppError):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: str = None):
        super().__init__(
            message=f"{resource} not found",
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": identifier},
        )


class RateLimitError(AppError):
    """Rate limit exceeded error."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Rate limit exceeded",
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": retry_after},
        )


class AIServiceError(AppError):
    """AI service error."""

    def __init__(self, message: str):
        super().__init__(message=message, code="AI_SERVICE_ERROR", status_code=503)


# =============================================================================
# METRICS COLLECTOR
# =============================================================================


class MetricsCollector:
    """
    Simple metrics collector for monitoring.
    Can be extended to push to Prometheus, DataDog, etc.
    """

    def __init__(self):
        self._counters: Dict[str, int] = {}
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = {}

    def increment(self, name: str, value: int = 1, tags: Dict = None):
        """Increment a counter."""
        key = self._make_key(name, tags)
        self._counters[key] = self._counters.get(key, 0) + value

    def gauge(self, name: str, value: float, tags: Dict = None):
        """Set a gauge value."""
        key = self._make_key(name, tags)
        self._gauges[key] = value

    def histogram(self, name: str, value: float, tags: Dict = None):
        """Record a histogram value."""
        key = self._make_key(name, tags)
        if key not in self._histograms:
            self._histograms[key] = []
        self._histograms[key].append(value)
        # Keep only last 1000 values
        if len(self._histograms[key]) > 1000:
            self._histograms[key] = self._histograms[key][-1000:]

    def _make_key(self, name: str, tags: Dict = None) -> str:
        """Create a unique key from name and tags."""
        if not tags:
            return name
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}[{tag_str}]"

    def get_stats(self) -> Dict[str, Any]:
        """Get all collected stats."""
        import statistics

        histogram_stats = {}
        for key, values in self._histograms.items():
            if values:
                histogram_stats[key] = {
                    "count": len(values),
                    "mean": statistics.mean(values),
                    "median": statistics.median(values),
                    "min": min(values),
                    "max": max(values),
                    "p95": values[int(len(values) * 0.95)]
                    if len(values) > 20
                    else max(values),
                }

        return {
            "counters": self._counters,
            "gauges": self._gauges,
            "histograms": histogram_stats,
        }


# =============================================================================
# INITIALIZE SERVICES
# =============================================================================

# Register services in container
Container.register("settings", get_settings)
Container.register("cache", lambda: CacheManager(default_ttl=300))
Container.register(
    "rate_limiter",
    lambda: RateLimiter(
        requests=get_settings().rate_limit_requests,
        period=get_settings().rate_limit_period,
    ),
)
Container.register("metrics", MetricsCollector)
Container.register("logger", lambda: setup_logging(get_settings()))
