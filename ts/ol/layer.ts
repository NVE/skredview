import {COLORS, VECTOR_OPACITY} from "../color";
import {getPrecision} from "../ol";
import * as Cookie from "../cookie";
import {get} from "../network";
import Overlay from "ol/Overlay";
import Map from "ol/Map";
import {Coordinate} from "ol/coordinate";
import {defaults as defaultInteractions} from "ol/interaction";
import {Extent} from "ol/extent";
import View, {ViewOptions} from "ol/View";
import TileLayer from "ol/layer/Tile";
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import {TileSourceEvent} from "ol/source/Tile";
import VectorImageLayer from "ol/layer/Vector";
import Vector from "ol/source/Vector";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Cluster from "ol/source/Cluster";
import CircleStyle from "ol/style/Circle";
import ImageStyle from "ol/style/Image";
import Text from "ol/style/Text";
import Tile from "ol/Tile";
import VectorSource from "ol/source/Vector";
import ImageLayer from "ol/layer/Image";
import {
    ImageArcGISRest,
    ImageWMS,
    TileArcGISRest,
    TileWMS,
    XYZ
} from "ol/source";
import {Layer} from "ol/layer";
import {register} from "ol/proj/proj4";
import proj4 from "proj4";
import LayerSwitcher = require("ol-layerswitcher");
import LayerGroup from "ol/layer/Group";
import TileGrid from "ol/tilegrid/TileGrid";

const EXP_TIMEOUT = 500;
const ATTR_NVE = [
    '© <a href="https://www.nve.no/" target="_blank">NVE</a>',
    '<a href="https://www.nve.no/om-nve/apne-data-og-api-fra-nve/" target="_blank">(CC BY 3.0)</a>'
].join(" ");
const ATTR_KV = [
    '© <a href="https://www.kartverket.no/" target="_blank">Kartverket</a>',
    '<a href="https://www.kartverket.no/data/lisens/" target="_blank">(CC BY 4.0)</a>'
].join(" ");
const ATTR_SE = [
    '© <a href="https://www.lantmateriet.se/" target="_blank">Lantmäteriet</a>',
    '<a href="https://www.kartverket.no/data/lisens/" target="_blank">(CC BY 4.0)</a>'
].join(" ");
const INIT_POS = [438700, 7264409];
const INIT_ZOOM = 7;
const TILE_URL = 'https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts/?';
const SWE_URL = 'https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/9a73d194-b3c4-399e-864b-52f568a87631/?';
const SJM_URL = 'https://geodata.npolar.no/arcgis/rest/services/Basisdata/NP_Basiskart_Svalbard_WMTS_25833/MapServer/WMTS?';
const PROJECTION = 'EPSG:25833';
const SE_PROJECTION = 'EPSG:3006';
const PROJECTION_EXTENT: Extent = [-2500000, 6420992, 1130000, 9045984];
const SJ_PROJECTION_EXTENT: Extent = [369976.3899489096, 8221306.539890718, 878234.7199568129, 9010718.76990194];
const SJ_ORIGIN = [-5120900.0, 9998100.0];
const SE_PROJECTION_EXTENT: Extent = [-1200000, 4305696, 2994304, 8500000];
const VIEW_EXTENT: Extent = [-1100000, 5450000, 2130000, 9000000];
const MIN_ZOOM = 6;
const MAX_ZOOM = 17;
const RESOLUTIONS = [
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
];
const SJM_RESOLUTIONS = [
    21674.7100160867,
    10837.35500804335,
    5418.677504021675,
    2709.3387520108377,
    1354.6693760054188,
    677.3346880027094,
    338.6673440013547,
    169.33367200067735,
    84.66683600033868,
    42.33341800016934,
    21.16670900008467,
    10.583354500042335,
    5.291677250021167,
    2.6458386250105836
];
const SE_RESOLUTIONS = [4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8]
const MATRIX_IDS = [
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
];

enum LayerType {
    Bw,
    Color
}

proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
register(proj4);

function createMap(layers: (Layer | LayerGroup)[], overlay: Overlay[]): Map {
    let storedE = parseFloat(Cookie.getCookie("eastings"));
    let storedN = parseFloat(Cookie.getCookie("northings"));
    let storedZoom = parseFloat(Cookie.getCookie("zoomLevel"));
    let center: Coordinate = storedE && storedN && storedZoom ? [storedE, storedN] : INIT_POS;
    let zoom = storedE && storedN && storedZoom ? storedZoom : INIT_ZOOM;
    let map = new Map({
        layers: layers,
        overlays: overlay,
        target: 'map',
        view: createView(VIEW_EXTENT, center, zoom),
        interactions: defaultInteractions({
            altShiftDragRotate: false,
            pinchRotate: false,
        }),
    });
    // @ts-ignore
    let switcher = new LayerSwitcher({
        tipLabel: 'Layers',
        groupSelectStyle: 'none'
    });
    switcher.setMap(map);
    map.addControl(switcher);
    return map;
}

function createView(extent: Extent, center: Coordinate, zoom: number): View {
    let options: ViewOptions = {
        projection: PROJECTION,
        center,
        zoom,
        //minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        //extent,
    };
    return new View(options);
}

function createBaseLayer(layerType: LayerType, backoff_counter: Record<string, number>): LayerGroup {
    let noLayer = new TileLayer({
        source: new WMTS({
            url: TILE_URL,
            attributions: ATTR_KV,
            tileGrid: new WMTSTileGrid({
                extent: PROJECTION_EXTENT,
                resolutions: RESOLUTIONS,
                matrixIds: MATRIX_IDS,
            }),
            layer: layerType == LayerType.Bw ? 'topo4graatone' : 'topo4',
            matrixSet: 'EPSG:25833',
            format: 'image/png',
            projection: PROJECTION,
            style: 'default',
            wrapX: false,
        }),
        zIndex: 1,
    });
    let seLayer = new TileLayer({
        source: new WMTS({
            url: SWE_URL,
            attributions: ATTR_SE,
            tileGrid: new WMTSTileGrid({
                extent: SE_PROJECTION_EXTENT,
                resolutions: SE_RESOLUTIONS,
                matrixIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            }),
            layer: layerType == LayerType.Bw ? 'topowebb_nedtonad' : 'topowebb',
            matrixSet: '3006',
            format: 'image/png',
            projection: SE_PROJECTION,
            style: 'default',
            wrapX: false,
        }),
        zIndex: 1,
    });
    let sjLayer = new TileLayer({
        source: new WMTS({
            url: SJM_URL,
            attributions: ATTR_SE,
            tileGrid: new WMTSTileGrid({
                extent: SJ_PROJECTION_EXTENT,
                resolutions: SJM_RESOLUTIONS,
                origin: SJ_ORIGIN,
                matrixIds: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
            }),
            projection: PROJECTION,
            wrapX: false,
            style: 'default',
            layer: 'NP_Basiskart_Svalbard_WMTS_25833',
            matrixSet: 'default028mm',
        }),
        zIndex: 1,
    });
    let baseLayer = new LayerGroup({
        layers: [seLayer, sjLayer, noLayer]
    });
    [noLayer, sjLayer, seLayer].forEach((layer) => {
        layer.getSource().on('tileloaderror', function (e: TileSourceEvent) {
            exponentialBackoff_(e.tile, backoff_counter);
        });
    });
    return baseLayer;
}

function createSlopeLayer(): LayerGroup {
    let seLayer = new TileLayer({
        zIndex: 2,
        opacity: 0.75,
        source: new TileWMS({
            url: 'http://nvgis.naturvardsverket.se/geoserver/lavinprognoser/ows?',
            params: {
                'LAYERS': 'lavinprognoser:slope_inclination',
                'TILED': true,
            }
        })
    });
    let noLayer = new ImageLayer({
        zIndex: 2,
        opacity: 0.5,
        source: new ImageArcGISRest({
            attributions: ATTR_NVE,
            params: {
                'layers': 'show:0,1',
            },
            url: 'https://gis3.nve.no/arcgis/rest/services/wmts/Bratthet/MapServer',
        }),
    });
    return new LayerGroup({
        layers: [seLayer, noLayer]
    });
}

function createRegionLayer(): VectorImageLayer<Vector> {
    return new VectorImageLayer({
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: new Style({
            fill: new Fill({
                color: [0, 0, 0, 0],
            }),
            stroke: new Stroke({
                color: COLORS.BORDER,
                width: 3,
            }),
        }),
        opacity: 0.5,
        zIndex: 3,
    });
}

function createSelectedRegionLayer(): VectorImageLayer<Vector> {
    return new VectorImageLayer({
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: new Style({
            fill: new Fill({
                color: [0, 0, 0, 0],
            }),
            stroke: new Stroke({
                color: COLORS.BORDER_SELECTED,
                width: 3,
            }),
        }),
        zIndex: 4,
    });
}

function createEventLayer(): VectorImageLayer<Vector> {
    let eventStyleCache: Record<string, Style> = {};
    return new VectorImageLayer({
        opacity: VECTOR_OPACITY,
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: (feature) => {
            let precision = getPrecision(feature);
            let color;
            if (precision < 24) {
                color = COLORS.PRECISION_NEW;
            } else if (precision <= 48) {
                color = COLORS.PRECISION_MEDIUM;
            } else {
                color = COLORS.PRECISION_OLD;
            }
            let style = eventStyleCache[color];
            if (!style) {
                style = new Style({
                    fill: new Fill({color}),
                    stroke: new Stroke({
                        color: COLORS.BORDER_EVENT,
                        width: 1,
                    }),
                });
                eventStyleCache[color] = style;
            }
            return style;
        },
        zIndex: 5,
    });
}

function createClusterLayer(): VectorImageLayer<Vector> {
    let clusterStyleCache: Record<number, Style> = {};
    return new VectorImageLayer({
        opacity: VECTOR_OPACITY,
        source: new VectorSource({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: (feature) => {
            let size = feature.get('size');
            let style = clusterStyleCache[size];
            if (!style) {
                style = new Style({
                    image: new CircleStyle({
                        radius: 20,
                        stroke: new Stroke({
                            color: '#fff',
                        }),
                        fill: new Fill({
                            color: COLORS.CLUSTER,
                        }),
                    }) as ImageStyle,
                    text: new Text({
                        text: size.toString(),
                        fill: new Fill({
                            color: '#fff'
                        }),
                    }),
                });
                clusterStyleCache[size] = style;
            }
            return style;
        },
        zIndex: 5,
    });
}

function exponentialBackoff_(tile: Tile, backoff_counter: Record<string, number>): void {
    let idx = tile.getTileCoord().toString();
    if (!(idx in backoff_counter)) {
        backoff_counter[idx] = 0;
    } else if (backoff_counter[idx] == 5) {
        return;
    }
    let delay = Math.random() * EXP_TIMEOUT * Math.pow(2, backoff_counter[idx]++);
    setTimeout(() => {
        tile.load();
    }, delay);
}

export {
    createMap,
    createView,
    createBaseLayer,
    createSlopeLayer,
    createRegionLayer,
    createSelectedRegionLayer,
    createEventLayer,
    createClusterLayer,
    LayerType,
};