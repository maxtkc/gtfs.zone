export interface BasemapStyle {
  id: string;
  name: string;
  type: 'raster';
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
}

export const basemaps: BasemapStyle[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  {
    id: 'stamen-toner',
    name: 'Stamen Toner (High Contrast)',
    type: 'raster',
    tiles: ['https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap contributors',
    maxzoom: 18,
  },
  {
    id: 'stamen-terrain',
    name: 'Stamen Terrain',
    type: 'raster',
    tiles: ['https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© Stadia Maps © Stamen Design © OpenStreetMap contributors',
    maxzoom: 18,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    type: 'raster',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    attribution: '© Esri',
    maxzoom: 19,
  },
];
