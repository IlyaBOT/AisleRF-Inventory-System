from pydantic import BaseModel, Field


class WarehousePublic(BaseModel):
    id: int
    name: str


class WarehouseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
