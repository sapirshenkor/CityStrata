""" main file for running the application """

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="CityStrata API",
        version="0.1.0",
                description="CityStrata – City classification platform for emergency scenarios (Eilat case study).",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


    return app

app = create_app()