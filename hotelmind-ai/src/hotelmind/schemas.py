"""API payload definitions with explicit feature validation."""
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator
from .config import CATEGORY_OPTIONS, MODEL_VERSION

EXAMPLE_BOOKING = {
    "hotel": "Resort Hotel", "arrival_date_month": "July", "meal": "BB",
    "market_segment": "Online TA", "distribution_channel": "TA/TO",
    "reserved_room_type": "A", "deposit_type": "No Deposit", "customer_type": "Transient",
    "lead_time": 130, "stays_in_weekend_nights": 2, "stays_in_week_nights": 3,
    "adults": 2, "children": 0, "babies": 0, "previous_cancellations": 0,
    "previous_bookings_not_canceled": 0, "adr": 115.5,
}


class BookingFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, json_schema_extra={"example": EXAMPLE_BOOKING})
    hotel: Literal["Resort Hotel", "City Hotel"]
    arrival_date_month: str = Field(min_length=3)
    meal: str = Field(min_length=1)
    market_segment: str = Field(min_length=1)
    distribution_channel: str = Field(min_length=1)
    reserved_room_type: str = Field(min_length=1)
    deposit_type: str = Field(min_length=1)
    customer_type: str = Field(min_length=1)
    lead_time: int = Field(ge=0)
    stays_in_weekend_nights: int = Field(ge=0)
    stays_in_week_nights: int = Field(ge=0)
    adults: int = Field(ge=0)
    children: int = Field(ge=0)
    babies: int = Field(ge=0)
    previous_cancellations: int = Field(ge=0)
    previous_bookings_not_canceled: int = Field(ge=0)
    adr: float = Field(ge=0, description="Average daily rate in the source dataset's currency")

    @model_validator(mode="after")
    def validate_stay(self):
        for field, options in CATEGORY_OPTIONS.items():
            if getattr(self, field) not in options:
                raise ValueError(f"{field} must be one of: {', '.join(options)}")
        if self.adults + self.children + self.babies < 1:
            raise ValueError("A booking must contain at least one guest")
        if self.stays_in_weekend_nights + self.stays_in_week_nights < 1:
            raise ValueError("A booking must contain at least one night")
        return self


class PredictionResponse(BaseModel):
    cancellation_probability: float = Field(ge=0, le=1)
    predicted_cancellation: bool
    risk_level: Literal["Low", "Medium", "High"]
    model_version: str = MODEL_VERSION
    model_name: str | None = None
    explanation: dict | None = None
