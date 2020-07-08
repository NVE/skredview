import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import View from 'ol/View';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import XYZ from 'ol/source/XYZ';

const INIT_POS = [438700, 7264409]
const INIT_ZOOM = 7
const PROJECTION = 'EPSG:25833'
const EXTENT: [number, number, number, number] = [-2500000, 6420992, 1130000, 9045984]
const TILE_URL = [
    'https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts/?',
    'layer=topo4&style=default&tilematrixset=EPSG:25833&',
    'Service=WMTS&Request=GetTile&Version=1.0.0&',
    'Format=image/png&',
    'TileMatrix=EPSG:25833:{z}&TileCol={x}&TileRow={y}'
].join('')
let RESOLUTIONS = [
  21664,
  10832,
  5416,
  2708,
  1354,
  677,
  338.5,
  169.25,
  84.625,
  42.3125,
  21.15625,
  10.578125,
  5.2890625,
  2.64453125,
  1.322265625,
  0.6611328125,
  0.33056640625,
  0.165283203125,
]
let MATRIX_IDS = [
    "EPSG:25833:0",
    "EPSG:25833:1",
    "EPSG:25833:2",
    "EPSG:25833:3",
    "EPSG:25833:4",
    "EPSG:25833:5",
    "EPSG:25833:6",
    "EPSG:25833:7",
    "EPSG:25833:8",
    "EPSG:25833:9",
    "EPSG:25833:10",
    "EPSG:25833:11",
    "EPSG:25833:12",
    "EPSG:25833:13",
    "EPSG:25833:14",
    "EPSG:25833:15",
    "EPSG:25833:16",
    "EPSG:25833:17",
]

let layers = [
  new TileLayer({
      source: new XYZ({
        url: TILE_URL,
        tileGrid: new WMTSTileGrid({
          tileSize: 256,
          extent: EXTENT,
          resolutions: RESOLUTIONS,
          matrixIds: MATRIX_IDS
        }),
        crossOrigin: 'Anonymous',
        projection: PROJECTION,
      }),
  })
];

let map = new Map({
    layers: layers,
    target: 'map',
    view: new View({
        center: INIT_POS,
        zoom: INIT_ZOOM
    })
});