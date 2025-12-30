"""Educational Institution Pydantic models"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .common import BaseResource, Point


class EducationalInstitutionBase(BaseModel):
    """Base model for educational institution"""

    institution_code: str
    institution_name: str
    address: Optional[str] = None
    full_address: Optional[str] = None
    type_of_supervision: Optional[str] = None
    type_of_education: Optional[str] = None
    education_phase: Optional[str] = None
    lat: float
    lon: float


class EducationalInstitution(EducationalInstitutionBase, BaseResource):
    """Full educational institution model"""

    id: str


class EducationalInstitutionCreate(EducationalInstitutionBase):
    """Model for creating new educational institution"""

    pass


class EducationalInstitutionGeoJSON(BaseModel):
    """GeoJSON properties for institution"""

    institution_code: str
    institution_name: str
    address: Optional[str]
    education_phase: Optional[str]
    type_of_education: Optional[str]
    stat_2022: int
