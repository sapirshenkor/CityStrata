"""Evacuation Analysis API endpoints"""

from fastapi import APIRouter, HTTPException
import asyncpg

from app.core.database import get_pool
from app.models.evacuation import (
    EvacuationRequest,
    EvacuationAnalysis,
    EvacuationCapacity,
    EvacuationNeed,
)

router = APIRouter(prefix="/evacuation", tags=["evacuation"])


@router.post("/analyze")
async def analyze_evacuation(request: EvacuationRequest):
    """
    Analyze evacuation capacity vs. need for specified areas.
    Calculates total capacity from Airbnb and population needs from institutions.
    """
    pool = get_pool()

    if not request.evacuate_areas:
        raise HTTPException(
            status_code=400, detail="At least one area must be specified for evacuation"
        )

    # Build placeholders for IN clause
    area_placeholders = ",".join(
        [f"${i+1}" for i in range(len(request.evacuate_areas))]
    )

    # Query capacity (Airbnb) for evacuate areas
    capacity_query = f"""
        SELECT 
            stat_2022,
            COUNT(*) as listing_count,
            COALESCE(SUM(person_capacity), 0)::int as airbnb_capacity
        FROM airbnb_listings
        WHERE semel_yish = 2600 
          AND stat_2022 IN ({area_placeholders})
        GROUP BY stat_2022
    """

    # Query need (institutions) for evacuate areas
    # Estimate: ~30 children per institution, ~5 staff per institution
    need_query = f"""
        SELECT 
            stat_2022,
            COUNT(*) as institutions_count,
            COUNT(*) * 30 as estimated_children,
            COUNT(*) * 5 as estimated_staff,
            COUNT(*) * 35 as total_estimated_population
        FROM educational_institutions
        WHERE semel_yish = 2600 
          AND stat_2022 IN ({area_placeholders})
        GROUP BY stat_2022
    """

    try:
        async with pool.acquire() as conn:
            # Get capacity data
            capacity_rows = await conn.fetch(capacity_query, *request.evacuate_areas)

            # Get need data
            need_rows = await conn.fetch(need_query, *request.evacuate_areas)

            # Build capacity by area
            capacity_by_area = []
            capacity_dict = {row["stat_2022"]: row for row in capacity_rows}

            for area in request.evacuate_areas:
                if area in capacity_dict:
                    row = capacity_dict[area]
                    capacity_by_area.append(
                        EvacuationCapacity(
                            stat_2022=area,
                            airbnb_capacity=row["airbnb_capacity"],
                            total_capacity=row[
                                "airbnb_capacity"
                            ],  # Could add other capacity sources
                        )
                    )
                else:
                    capacity_by_area.append(
                        EvacuationCapacity(
                            stat_2022=area, airbnb_capacity=0, total_capacity=0
                        )
                    )

            # Build need by area
            need_by_area = []
            need_dict = {row["stat_2022"]: row for row in need_rows}

            for area in request.evacuate_areas:
                if area in need_dict:
                    row = need_dict[area]
                    need_by_area.append(
                        EvacuationNeed(
                            stat_2022=area,
                            institutions_count=row["institutions_count"],
                            estimated_children=row["estimated_children"],
                            estimated_staff=row["estimated_staff"],
                            total_estimated_population=row[
                                "total_estimated_population"
                            ],
                        )
                    )
                else:
                    need_by_area.append(
                        EvacuationNeed(
                            stat_2022=area,
                            institutions_count=0,
                            estimated_children=0,
                            estimated_staff=0,
                            total_estimated_population=0,
                        )
                    )

            # Calculate totals
            total_capacity = sum(c.total_capacity for c in capacity_by_area)
            total_need = sum(n.total_estimated_population for n in need_by_area)
            capacity_deficit = total_capacity - total_need

            # Generate recommendations
            recommendations = []
            if capacity_deficit < 0:
                recommendations.append(
                    f"WARNING: Capacity deficit of {abs(capacity_deficit)} people. "
                    f"Need to find additional accommodation."
                )
            else:
                recommendations.append(
                    f"Sufficient capacity available: {capacity_deficit} surplus spaces."
                )

            if request.resource_areas:
                recommendations.append(
                    f"Consider utilizing resources from areas: {', '.join(map(str, request.resource_areas))}"
                )

            if total_need == 0:
                recommendations.append(
                    "No educational institutions found in specified areas."
                )

            return EvacuationAnalysis(
                evacuate_areas=request.evacuate_areas,
                total_need=total_need,
                total_capacity=total_capacity,
                capacity_deficit=capacity_deficit,
                capacity_by_area=capacity_by_area,
                need_by_area=need_by_area,
                recommendations=recommendations,
                scenario=request.scenario,
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
