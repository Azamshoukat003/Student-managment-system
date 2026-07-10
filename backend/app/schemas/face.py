from pydantic import BaseModel


class FaceRegisterRequest(BaseModel):
    frames: list[str]  # base64 data URLs


class FaceRegisterResponse(BaseModel):
    registered: bool
    samples_saved: int
    message: str = ""
