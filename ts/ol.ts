import {Controls, addRegion, initControls} from "./controls";
import * as Cookie from "./cookie";
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import Vector from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import View from 'ol/View';
import GeoJSON, {GeoJSONFeature, GeoJSONFeatureCollection} from "ol/format/GeoJSON";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import Tile from "ol/Tile";
import {TileSourceEvent} from "ol/source/Tile";
import Cluster from "ol/source/Cluster";
import {Extent} from 'ol/extent';
import WMTS from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import {register} from 'ol/proj/proj4.js';
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import ImageStyle from "ol/style/Image";
import proj4 from 'proj4';
import VectorSource from "ol/source/Vector";
import Feature, {FeatureLike} from "ol/Feature";
import Layer from "ol/layer/Layer";
import booleanWithin from "@turf/boolean-within";
import * as helpers from "@turf/helpers";

interface OlObjects {
    map: Map,
    events: Record<string, boolean>,
    clusters: Record<string, boolean>,
    eventsLoaded: [boolean],
    eventsLoadStart: [boolean],
    clusterLoaded: [boolean],
    clusterLoadStart: [boolean],
    events_part_req: [XMLHttpRequest | null],
    events_all_req: [XMLHttpRequest | null],
    cluster_part_req: [XMLHttpRequest | null],
    cluster_all_req: [XMLHttpRequest | null],
    backoff_counter: Record<string, number>,
    regions: Record<string, Feature>,
    baseLayer: TileLayer,
    regionLayer: VectorLayer,
    selectedRegionLayer: VectorLayer,
    eventLayer: VectorLayer,
    clusterLayer: VectorLayer,
}

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
const EXP_TIMEOUT = 500;
const TILE_URL = 'https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts/?';

proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
register(proj4);

const COLORS = {
    NEW: '#e7298a',
    MEDIUM: '#d95f02',
    OLD: '#7570b3',
    BORDER: '#ff6354',
    BORDER_SELECTED: '#7fed0b',
};

const PROJECTION = 'EPSG:25833';
const PROJECTION_EXTENT: Extent = [ -2500000, 6420992, 1130000, 9045984 ];
const VIEW_EXTENT: Extent = [ -100000,  6450000, 1130000, 8000000 ];
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

function initMap(controls: Controls): OlObjects {
    let events: Record<string, boolean> = {};
    let clusters: Record<string, boolean> = {};
    let regions: Record<string, Feature> = {};
    let backoff_counter: Record<string, number> = {};

    let baseLayer = createBaseLayer_(backoff_counter);
    let regionLayer = createRegionLayer_(regions, controls);
    let selectedRegionLayer = createSelectedRegionLayer_();
    let eventLayer = createEventLayer_();
    let clusterLayer = createClusterLayer_();

    let layers = [
        baseLayer,
        regionLayer,
        selectedRegionLayer,
        eventLayer,
        clusterLayer,
    ];

    let map = createMap_(layers);

    let ol: OlObjects = {
        map,
        events,
        clusters,
        eventsLoaded: [false],
        eventsLoadStart: [false],
        clusterLoaded: [false],
        clusterLoadStart: [false],
        events_part_req: [null],
        events_all_req: [null],
        cluster_part_req: [null],
        cluster_all_req: [null],
        backoff_counter,
        regions,
        baseLayer,
        regionLayer,
        selectedRegionLayer,
        eventLayer,
        clusterLayer
    };

    getCluster(ol, controls);
    updateMapState(ol);

    return ol;
}

function getEvents(ol: OlObjects, controls: Controls): void {
    let dateStart = controls.dateStart.value as string;
    let dateEnd = controls.dateEnd.value as string;
    let bbox = ol.map.getView().calculateExtent();
    getVector_(
        `/api/events/polygons/within/${bbox.join('/')}/?start=${dateStart}&end=${dateEnd}`,
        `/api/events/polygons/?start=${dateStart}&end=${dateEnd}`,
        ol.eventsLoaded,
        ol.eventsLoadStart,
        ol.events,
        ol.events_part_req,
        ol.events_all_req,
        ol.eventLayer.getSource(),
        ol,
        controls,
    );
}

function getCluster(ol: OlObjects, controls: Controls): void {
    let dateStart = controls.dateStart.value as string;
    let dateEnd = controls.dateEnd.value as string;
    let bbox = ol.map.getView().calculateExtent();
    let clusterSource = ol.clusterLayer.getSource() as Cluster;
    getVector_(
        `/api/events/points/within/${bbox.join('/')}/?start=${dateStart}&end=${dateEnd}`,
        `/api/events/points/?start=${dateStart}&end=${dateEnd}`,
        ol.clusterLoaded,
        ol.clusterLoadStart,
        ol.clusters,
        ol.cluster_part_req,
        ol.cluster_all_req,
        clusterSource.getSource(),
        ol,
        controls,
    );
}

function resetVectors(ol: OlObjects, clear: boolean): void {
    [
        ol.events_part_req,
        ol.events_all_req,
        ol.cluster_part_req,
        ol.cluster_all_req
    ].forEach((req) => {
        if (req[0]) {
            req[0].abort();
            req[0] = null;
        }
    });
    ol.eventsLoadStart[0] = false;
    ol.eventsLoaded[0] = false;
    ol.clusterLoadStart[0] = false;
    ol.clusterLoaded[0] = false;
    if (clear) {
        ol.eventLayer.getSource().clear();
        (ol.clusterLayer.getSource() as Cluster).getSource().clear();
        ol.events = {};
        ol.clusters = {};
    }
}

function updateMapState(ol: OlObjects): void {
    let zoomLevel = ol.map.getView().getZoom();
    let coordinates = ol.map.getView().getCenter();
    if (zoomLevel < 11) {
        ol.eventLayer.setVisible(false);
        ol.clusterLayer.setVisible(true);
    } else {
        ol.eventLayer.setVisible(true);
        ol.clusterLayer.setVisible(false);
    }

    Cookie.setCookie("zoomLevel", zoomLevel.toString(), Cookie.TTL);
    Cookie.setCookie("eastings", coordinates[0].toString(), Cookie.TTL);
    Cookie.setCookie("northings", coordinates[1].toString(), Cookie.TTL);
}

function selectRegion(ol: OlObjects, controls: Controls): void {
    let name = controls.regionSelector.value;
    let source = ol.selectedRegionLayer.getSource();
    source.clear();
    if (name) source.addFeature(ol.regions[name]);
}

function panToRegion(controls: Controls, ol: OlObjects): void {
    let name = controls.regionSelector.value;
    if (name) {
        let geometry = ol.regions[name].getGeometry();
        ol.map.getView().fit(geometry.getExtent(), {duration: 700});
    }
}

function createMap_(layers: Layer[]): Map {
    let storedEastings = parseFloat(Cookie.getCookie("eastings"));
    let storedNorthings = parseFloat(Cookie.getCookie("northings"));
    let storedZoomLevel = parseFloat(Cookie.getCookie("zoomLevel"));
    return new Map({
        layers: layers,
        target: 'map',
        view: new View({
            projection: PROJECTION,
            center: storedEastings && storedNorthings && storedZoomLevel? [storedEastings, storedNorthings] : INIT_POS,
            zoom: storedEastings && storedNorthings && storedZoomLevel? storedZoomLevel : INIT_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            extent: VIEW_EXTENT,
        }),
    });
}

function createBaseLayer_(backoff_counter: Record<string, number>): TileLayer {
    let baseLayer = new TileLayer({
        source: new WMTS({
            url: TILE_URL,
            attributions: ATTR_KV,
            tileGrid: new WMTSTileGrid({
                extent: PROJECTION_EXTENT,
                resolutions: RESOLUTIONS,
                matrixIds: MATRIX_IDS,
            }),
            layer: 'topo4graatone',
            matrixSet: 'EPSG:25833',
            format: 'image/png',
            projection: PROJECTION,
            style: 'default',
            wrapX: false,
        }),
        zIndex: 1,
    });
    baseLayer.getSource().on('tileloaderror', function(e: TileSourceEvent) {
      exponentialBackoff_(e.tile, backoff_counter);
    });
    return baseLayer;
}

function createRegionLayer_(regions: Record<string, Feature>, controls: Controls): VectorLayer {
    let regionLayer = new VectorLayer({
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: new Style({
            stroke: new Stroke({
                color: COLORS.BORDER,
                width: 3,
            }),
        }),
        opacity: 0.5,
        zIndex: 2,
    });
    let url = '/static/geojson/areas.json';
    get_(url, [null], responseText => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let features = new GeoJSON({
            dataProjection: 'EPSG:4326',
            featureProjection: PROJECTION,
        }).readFeatures(json);
        features.forEach((feature) => {
            let name = feature.get("label");
            regions[name] = feature;
        });
        let regionNames = Object.keys(regions).sort((s1, s2) => {
            return s1.localeCompare(s2, 'no-NO');
        });
        regionNames.forEach((regionName) => {
            addRegion(regionName, controls);
        });
        regionLayer.getSource().addFeatures(features);
    });
    return regionLayer;
}

function createSelectedRegionLayer_(): VectorLayer {
    return new VectorLayer({
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: new Style({
            stroke: new Stroke({
                color: COLORS.BORDER_SELECTED,
                width: 3,
            }),
        }),
        opacity: 0.5,
        zIndex: 3,
    });
}

function createEventLayer_(): VectorLayer {
    let eventStyleCache: Record<string, Style> = {};
    return new VectorLayer({
        opacity: 0.85,
        source: new Vector({
            attributions: ATTR_NVE,
            wrapX: false,
        }),
        style: (feature) => {
            let color = colorize_(feature);
            let style = eventStyleCache[color];
            if (!style) {
                style = new Style({
                    fill: new Fill({color}),
                    stroke: new Stroke({color}),
                });
                eventStyleCache[color] = style;
            }
            return style;
        },
        zIndex: 4,
    });
}

function createClusterLayer_(): VectorLayer {
    let clusterStyleCache: Record<number, Style> = {};
    return new VectorLayer({
        source: new Cluster({
            source: new VectorSource(),
            attributions: ATTR_NVE,
            wrapX: false,
            distance: 40,
        }),
        style: (feature) => {
            let features = feature.get('features');
            let color;
            for (let feature of features) {
                let featureColor = colorize_(feature);
                if (featureColor == COLORS.NEW) {
                    color = featureColor;
                    break;
                } else if (featureColor == COLORS.MEDIUM) {
                    color = featureColor;
                } else if (!color) {
                    color = featureColor;
                }
            }
            let size = features.length;
            let style = clusterStyleCache[size];
            if (!style) {
                style = new Style({
                    image: new CircleStyle({
                        radius: 10,
                        stroke: new Stroke({
                            color: '#fff'
                        }),
                        fill: new Fill({color}),
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
        zIndex: 4,
    });
}

function getVector_(
    part_url: string,
    all_url: string,
    isLoaded: [boolean],
    isStarted: [boolean],
    existMap: Record<string, boolean>,
    part_req: [XMLHttpRequest | null],
    all_req: [XMLHttpRequest | null],
    source: VectorSource,
    ol: OlObjects,
    controls: Controls,
): void {
    if (isLoaded[0]) return;

    let closure = (responseText: string) => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let newEvents: GeoJSONFeatureCollection = helpers.featureCollection([]);

        json.features.forEach((feature: GeoJSONFeature) => {
            if (!existMap[feature.properties.skredID]) {
                newEvents.features.push(feature);
                existMap[feature.properties.skredID] = true;
            }
        });
        let features = new GeoJSON().readFeatures(newEvents);

        let filtered = filterArrayByRegions_(features, true, controls, ol);
        source.addFeatures(filtered);
    };

    get_(part_url, part_req, closure);
    if (!isStarted[0]) {
        isStarted[0] = true;
        get_(all_url, all_req, (responseText) => {
            isLoaded[0] = true;
            closure(responseText);
        });
    }
}

function filterArrayByRegions_(array: Feature[], keep: boolean, controls: Controls, ol: OlObjects): Feature[]{
    let name = controls.regionSelector.value;
    if (name) {
        let geometry = ol.regions[name].getGeometry();
        let geoJson = new GeoJSON();
        let geoJsonRegion = geoJson.writeGeometryObject(geometry);
        return array.map((feature) => {
            let geoJsonEvent = geoJson.writeGeometryObject(feature.getGeometry());
            if (booleanWithin(geoJsonEvent, geoJsonRegion) == keep) return feature;
        }).filter(Boolean);
    } else if (keep) {
        return array;
    } else {
        return [];
    }
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

function colorize_(feature: FeatureLike): string {
    let intervals = [
        'Eksakt',
        '1 min',
        '1 time',
        '4 timer',
        '6 timer',
        '12 timer',
        '1 dag',
        '1 dager',
        '2 dager',
    ];
    let interval = feature.get('noySkredTidspunkt');
    let index = intervals.indexOf(interval);
    if (index == -1) {
        return COLORS.OLD;
    } else if (index > intervals.indexOf('1 dag')) {
        return COLORS.MEDIUM;
    } else {
        return COLORS.NEW;
    }
}

function get_(url: string, old_request: [XMLHttpRequest | null], callback: (responseText: string) => void): void {
    if (old_request[0]) old_request[0].abort()
    let request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onreadystatechange = () => {
        if (request.readyState == XMLHttpRequest.DONE) {
            if (request.status >= 200 && request.status < 400) {
                callback(request.responseText);
            }
        }
    };
    request.send();
    old_request[0] = request;
}

export {
    COLORS,
    OlObjects,
    initMap,
    getEvents,
    resetVectors,
    getCluster,
    updateMapState,
    selectRegion,
    panToRegion,
};