from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://vigil:changeme@localhost:5432/vigil"

    # MQTT
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    mqtt_topic: str = "vigil/machines/+/readings"

    # API
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175"

    # Energy cost
    default_tariff_inr_per_kwh: float = 8.50

    # Anomaly detection
    anomaly_min_baseline_samples: int = 60
    anomaly_warning_z: float = 2.5
    anomaly_critical_z: float = 4.0
    anomaly_baseline_window: int = 300
    # Number of *consecutive* readings a signal must exceed the z-threshold before
    # an alert is raised.  This is the primary defence against single-sample outlier
    # spikes (electrical transients, brief vibration from nearby equipment, etc.).
    # Set to 1 to disable debouncing (instant-fire on first threshold crossing).
    # Recommended range: 3–6 for 3-second polling; increase for higher poll rates.
    anomaly_debounce_count: int = 5

    # Simulator (internal, dev/demo only)
    simulator_machine_id: str = "machine-001"
    simulator_interval_s: float = 3.0

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
