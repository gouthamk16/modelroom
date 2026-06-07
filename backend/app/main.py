from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="ModelRoom", version="0.1.0")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
