"""config file for the application"""

"""
This module provides a configuration for the application.
It uses pydantic-settings to load the configuration from the .env file.
The configuration is used to configure the application.
"""
from dotenv import find_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = find_dotenv(".env", usecwd=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8")

    # supabase API credentials
    ENV: str = "dev"
    DATABASE_URL: str

    print("Loading .env from:", ENV_FILE)


settings = Settings()
