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
import {ImageArcGISRest, ImageWMS} from "ol/source";
import {Layer} from "ol/layer";
import {register} from "ol/proj/proj4";
import proj4 from "proj4";
import LayerSwitcher = require("ol-layerswitcher");
import LayerGroup from "ol/layer/Group";

const EXP_TIMEOUT = 500;
const ATTR_NVE = [
    '© <a href="https://www.nve.no/" target="_blank">NVE</a>',
    '<a href="https://www.nve.no/om-nve/apne-data-og-api-fra-nve/" target="_blank">(CC BY 3.0)</a>'
].join(" ");
const ATTR_KV = [
    '© <a href="https://www.kartverket.no/" target="_blank">Kartverket</a>',
    '<a href="https://www.kartverket.no/data/lisens/" target="_blank">(CC BY 4.0)</a>'
].join(" ");
const INIT_POS = [438700, 7264409];
const INIT_ZOOM = 7;
const TILE_URL = 'https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts/?';
const PROJECTION = 'EPSG:25833';
const PROJECTION_EXTENT: Extent = [-2500000, 6420992, 1130000, 9045984];
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
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        extent,
    };
    return new View(options);
}

function createBaseLayer(layerName: string, backoff_counter: Record<string, number>): TileLayer {
    let baseLayer = new TileLayer({
        source: new WMTS({
            url: TILE_URL,
            attributions: ATTR_KV,
            tileGrid: new WMTSTileGrid({
                extent: PROJECTION_EXTENT,
                resolutions: RESOLUTIONS,
                matrixIds: MATRIX_IDS,
            }),
            layer: layerName,
            matrixSet: 'EPSG:25833',
            format: 'image/png',
            projection: PROJECTION,
            style: 'default',
            wrapX: false,
        }),
        zIndex: 1,
    });
    baseLayer.getSource().on('tileloaderror', function (e: TileSourceEvent) {
        exponentialBackoff_(e.tile, backoff_counter);
    });
    return baseLayer;
}

function createOrthoLayer(): ImageLayer {
    let baseLayerOrtho = new ImageLayer({
        extent: [-250025, 6299985, 1211155, 8985010],
        zIndex: 1,
        source: new ImageWMS(),
    });
    let orthoStartDate: Date;
    let orthoClosure = () => {
        if (!orthoStartDate || new Date().getTime() - orthoStartDate.getTime() > 1000 * 3000) {
            get("/api/baat/nib", [null], (ticket) => {
                orthoStartDate = new Date();
                baseLayerOrtho.setSource(new ImageWMS({
                    url: 'https://wms.geonorge.no/skwms1/wms.nib',
                    attributions: ATTR_KV,
                    params: {
                        'ticket': ticket,
                        'layers': 'ortofoto',
                    },
                }));
            });
        }
        setTimeout(orthoClosure, 1000 * 3000);
    };
    setTimeout(orthoClosure, 0);
    return baseLayerOrtho;
}

function createNveLayer(url: string, layer: string): ImageLayer {
    return new ImageLayer({
        zIndex: 2,
        opacity: 0.5,
        source: new ImageArcGISRest({
            attributions: ATTR_NVE,
            params: {
                'layers': layer,
            },
          url,
        }),
    });
}

function createRegionLayer(): VectorImageLayer {
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

function createSelectedRegionLayer(): VectorImageLayer {
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

function createEventLayer(): VectorImageLayer {
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

function createClusterLayer(): VectorImageLayer {
    let clusterStyleCache: Record<number, Style> = {};
    return new VectorImageLayer({
        opacity: VECTOR_OPACITY,
        source: new Cluster({
            source: new VectorSource(),
            attributions: ATTR_NVE,
            wrapX: false,
            distance: 40,
        }),
        style: (feature) => {
            let features = feature.get('features');
            let size = features.length;
            let style = clusterStyleCache[size];
            if (!style) {
                style = new Style({
                    image: new CircleStyle({
                        radius: 10,
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
    createOrthoLayer,
    createNveLayer,
    createRegionLayer,
    createSelectedRegionLayer,
    createEventLayer,
    createClusterLayer,
};