import { useEffect, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type CountryFeature = Feature<Geometry, { name: string }>;
export type WorldGeo = FeatureCollection<Geometry, { name: string }>;

const ANTARCTICA_ID = '010';
let cache: Promise<WorldGeo> | null = null;

/** Carrega as fronteiras reais (Natural Earth 1:110m) uma única vez, em chunk separado */
export function loadWorldGeo(): Promise<WorldGeo> {
  if (!cache) {
    cache = import('world-atlas/countries-110m.json').then((mod) => {
      const topo = (mod.default ?? mod) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
      const fc = feature(topo, topo.objects.countries) as WorldGeo;
      return { ...fc, features: fc.features.filter((f) => String(f.id) !== ANTARCTICA_ID) };
    });
  }
  return cache;
}

export function useWorldGeo(): WorldGeo | null {
  const [geo, setGeo] = useState<WorldGeo | null>(null);
  useEffect(() => {
    let alive = true;
    loadWorldGeo().then((g) => alive && setGeo(g));
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}
