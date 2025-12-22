
create table if not exists public.statistical_areas (
    id uuid primary key default gen_random_uuid(),
    
    semel_yish integer not null,  --will 2600 for Eilat
    stat_2022 integer not null,  --statistical area code number
    
    --our geometry after coverting to EPSG:4326
    geom geometry(Polygon, 4326) not null,


    area_m2 double precision null,  
    centroid geometry(Point, 4326) null,    

    --we will keep all extra SHP columns in here
    properties jsonb not null default '{}'::jsonb,

    source text not null default 'CBS_2022',
    imported_at timestamptz not null default now(),

    
    unique(semel_yish, stat_2022)
);

create index if not exists idx_stat_areas_geom
  on public.statistical_areas using gist (geom);

create index if not exists idx_stat_areas_semel
  on public.statistical_areas (semel_yish);

create index if not exists idx_stat_areas_stat
  on public.statistical_areas (stat_2022);



