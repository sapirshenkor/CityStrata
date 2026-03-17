from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime

class EvacueeFamilyProfileBase(BaseModel):
    """Base fields shared across all models."""
    
    # --- Contact & Location Information ---
    family_name: str
    contact_name: str
    contact_phone: str
    contact_email: str
    home_stat_2022: Optional[int] = None # Optional because we agreed it can be NULL
    city_name: str
    home_address: str

    # --- Part 1: Family Composition ---
    total_people: int
    infants: int = 0
    preschool: int = 0
    elementary: int = 0
    youth: int = 0
    adults: int = 0
    seniors: int = 0
    has_mobility_disability: bool = False
    has_car: bool = True

    # --- Part 2: Educational Infrastructure ---
    essential_education: Optional[List[str]] = Field(default_factory=list)
    education_proximity_importance: int = Field(default=3, ge=1, le=5)

    # --- Part 3: Religious & Cultural Infrastructure ---
    religious_affiliation: Literal['secular', 'traditional', 'religious', 'haredi', 'other']
    needs_synagogue: bool = False
    culture_frequency: Literal['daily', 'weekly', 'rarely'] = 'rarely'

    # --- Part 4: Community & Social Interaction ---
    matnas_participation: bool = False
    social_venues_importance: int = Field(default=3, ge=1, le=5)
    needs_community_proximity: bool = False

    # --- Part 5: Housing & Accommodation Preferences ---
    accommodation_preference: Literal['airbnb', 'hotel'] = 'airbnb'
    estimated_stay_duration: Optional[str] = None

    # --- Part 6: Urban Services & Extra ---
    needs_medical_proximity: bool = False
    services_importance: int = Field(default=3, ge=1, le=5)
    notes: Optional[str] = None


class EvacueeFamilyProfileCreate(EvacueeFamilyProfileBase):
    """Model for creating a new profile. Inherits exactly from Base."""
    pass


class EvacueeFamilyProfileUpdate(EvacueeFamilyProfileBase):
    """Model for partial updates (PATCH). All fields become optional."""
    
    # Redefining contact fields as Optional for PATCH requests
    family_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    city_name: Optional[str] = None
    home_address: Optional[str] = None
    total_people: Optional[int] = None
    religious_affiliation: Optional[Literal['secular', 'traditional', 'religious', 'haredi', 'other']] = None
    
    # The rest are already optional or have defaults in the Base, 
    # but strictly for PATCH, we usually mark everything Optional.
    # (For brevity, I'm showing the strict required ones made optional).


class EvacueeFamilyProfile(EvacueeFamilyProfileBase):
    """Model returned from the Database to the client."""
    
    # System fields from DB
    id: int
    uuid: UUID
    created_at: datetime
    updated_at: datetime
    selected_matching_result_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True) # Replaces Config: orm_mode = True for Pydantic V2