"""config file for the application"""

"""
This module provides a configuration for the application.
It uses pydantic-settings to load the configuration from the .env file.
The configuration is used to configure the application.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env file in project root (parent of backend directory)
backend_dir = Path(
    __file__
).parent.parent.parent  # app/core/config.py -> backend/app/core -> backend
project_root = backend_dir.parent  # backend -> project root
env_file_path = project_root / ".env"

ENV_FILE = str(env_file_path) if env_file_path.exists() else None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")

    # supabase API credentials
    ENV: str = "dev"
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # OpenAI (for matching agent); optional so app starts without it
    openai_api_key: str | None = None

    print("Loading .env from:", ENV_FILE)


settings = Settings()
