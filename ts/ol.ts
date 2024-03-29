import {addRegion, Controls} from "./controls";
import {dateRange, getDate, db2Date} from "./date";
import {get} from "./network";
import * as Cookie from "./cookie";
import * as Layer from "./ol/layer";
import * as Popup from "./ol/popup";
import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import VectorImageLayer from 'ol/layer/Vector';
import GeoJSON, {GeoJSONFeature, GeoJSONFeatureCollection} from "ol/format/GeoJSON";
import Cluster from "ol/source/Cluster";
import {containsCoordinate, Extent} from 'ol/extent';
import VectorSource from "ol/source/Vector";
import Feature, {FeatureLike} from "ol/Feature";
import Overlay from 'ol/Overlay.js';
import Polygon from "ol/geom/Polygon";
import * as turf from '@turf/turf';
import Group from "ol/layer/Group";
import ImageLayer from "ol/layer/Image";
import { yieldingForEach } from "./loop";
import { AllGeoJSON, Point } from "@turf/turf";
import { Vector, WMTS } from "ol/source";
import LayerGroup from "ol/layer/Group";
import {LayerType} from "./ol/layer";
import {Geometry} from "ol/geom";

interface PointApi {
    regions: Record<string, number>
    dates_gt48: Record<string, number>
    dates_lte48: Record<string, number>
    dates_lt24: Record<string, number>
    elevations_gt48: Record<string, number>
    elevations_lte48: Record<string, number>
    elevations_lt24: Record<string, number>
    expositions_gt48: Record<string, number>
    expositions_lte48: Record<string, number>
    expositions_lt24: Record<string, number>
}

interface OlObjects {
    // Ol Map object
    map: Map,

    // Record of avalanche polygons displayed on the map. eventsByDate['yyyy-mm-dd'][uuid]
    eventsByDate: Record<string, Record<string, Feature>>,

    // Record cache of all avalanche polygons ever seen. eventStoredsByDate['yyyy-mm-dd'][uuid]
    eventsStoredByDate: Record<string, Record<string, Feature>>,

    // Indicates if the event layer has started loading.
    eventsLoaded: [boolean],

    points: PointApi,

    // XHR used to load the event layer within frame.
    events_part_req: [XMLHttpRequest | null],
    // XHR used to load the cluster layer completely.
    cluster_all_req: [XMLHttpRequest | null],

    // Keeps track of the number of times basemap tiles has failed to load.
    backoff_counter_bw: Record<string, number>,
    backoff_counter_color: Record<string, number>,

    // Map of regions by their numerical IDs.
    regions: Record<number, Feature>,

    baseLayerBw: LayerGroup,
    baseLayerColor: LayerGroup,
    regionLayer: VectorImageLayer<Vector>,
    // Layer containing currently selected region.
    selectedRegionLayer: VectorImageLayer<Vector>,
    // Avalanche polygon layer.
    eventLayer: VectorImageLayer<Vector>,
    // Avalanche cluster layer.
    clusterLayer: VectorImageLayer<Vector>,
    // Layer containing the avalanche polygon currently shown in the popup.
    selectedEventLayer: VectorImageLayer<Vector>,
    // Popup overlay.
    popupOverlay: [Overlay, HTMLDivElement],

    // Center of each region
    regionCenters: Record<number, Feature>
}

const CLUSTER_THRESHOLD = 11;
const ASSOCIATED_REGIONS: {[key: number]: number[]} = {
    5052: [5002, 5008],
    5051: [5001, 5009],
    5050: [5003, 5007],
}

/**
 * Initializes the map.
 * @param controls: Controls
 * @return OlObjects
 */
function initMap(controls: Controls): OlObjects {
    let eventsByDate: Record<string, Record<string, Feature>> = {};
    let clustersByDate: Record<string, Record<string, Feature>> = {};
    let eventsStoredByDate: Record<string, Record<string, Feature>> = {};
    let clustersStoredByDate: Record<string, Record<string, Feature>> = {};
    let regions: Record<string, Feature> = {};
    let backoff_counter_bw: Record<string, number> = {};
    let backoff_counter_color: Record<string, number> = {};

    let baseLayerBw = Layer.createBaseLayer(LayerType.Bw, backoff_counter_bw);
    baseLayerBw.setZIndex(0);
    baseLayerBw.set('title', 'Grayscale Topo Map');
    baseLayerBw.set('type', 'base');
    baseLayerBw.set('combine', true);

    let baseLayerColor = Layer.createBaseLayer(LayerType.Color, backoff_counter_color);
    baseLayerColor.set('title', 'Color Topo Map');
    baseLayerColor.set('type', 'base');
    baseLayerColor.set('combine', true);

    let slopeLayer = Layer.createSlopeLayer();
    slopeLayer.setVisible(false)
    slopeLayer.set('title', 'Slope');
    slopeLayer.set('combine', true);

    let regionLayer = Layer.createRegionLayer();
    let selectedRegionLayer = Layer.createSelectedRegionLayer();
    let eventLayer = Layer.createEventLayer();
    let selectedEventLayer = Layer.createEventLayer();
    let clusterLayer = Layer.createClusterLayer();
    selectedEventLayer.setOpacity(1);
    selectedEventLayer.setZIndex(6);

    let points = {
        regions: {},
        dates_gt48: {},
        dates_lte48: {},
        dates_lt24: {},
        elevations_gt48: {},
        elevations_lte48: {},
        elevations_lt24: {},
        expositions_gt48: {},
        expositions_lte48: {},
        expositions_lt24: {},
    }

    let baseGroup = new Group({
        layers: [
            baseLayerColor,
            baseLayerBw,
        ]
    });
    baseGroup.set('title', 'Baselayers');
    let extraGroup = new Group({
        layers: [
            slopeLayer,
        ]
    });
    extraGroup.set('title', 'Overlays');

    let layers = [
        extraGroup,
        baseGroup,
        regionLayer,
        selectedRegionLayer,
        eventLayer,
        clusterLayer,
        selectedEventLayer,
    ];

    let ol: OlObjects = {
        map: null,
        eventsByDate,
        eventsStoredByDate,
        eventsLoaded: [false],
        events_part_req: [null],
        cluster_all_req: [null],
        backoff_counter_bw,
        backoff_counter_color,
        points,
        regions,
        baseLayerBw,
        baseLayerColor,
        regionLayer,
        selectedRegionLayer,
        eventLayer,
        clusterLayer,
        selectedEventLayer,
        popupOverlay: null,
        regionCenters: {},
    };
    let [overlay, content] = Popup.createPopupOverlay(ol);
    ol.map = Layer.createMap(layers, [overlay]);
    ol.popupOverlay = [overlay, content];

    getRegions_(controls, ol);

    updateMapState(ol);

    return ol;
}

/**
 * Fill ol.eventLayer with the currently relevant objects, from cache and online resources.
 * @param ol: OlObjects
 * @param controls: Controls
 * @param callback: (filtered: Feature[]) => void - filtered is the features not previously existing in the layer.
 */
function getEvents(
    ol: OlObjects,
    controls: Controls,
    callback: (filtered: Feature[], complete: boolean) => void,
): void {
    let dateStart = controls.dateStart.value as string;
    let dateEnd = controls.dateEnd.value as string;
    let bbox = ol.map.getView().calculateExtent();
    let regionParam = "";
    let region_s = controls.regionSelector.value
    if (region_s) {
        let region = parseInt(region_s, 10);
        regionParam = `&region=${controls.regionSelector.value}`
        if (region in ASSOCIATED_REGIONS) {
            regionParam += `,${ASSOCIATED_REGIONS[region].join(',')}`
        }
    }
    recallVector_(
        dateRange(new Date(controls.dateStart.value), new Date(controls.dateEnd.value)),
        ol.eventsByDate,
        ol.eventsStoredByDate,
        ol.eventLayer.getSource(),
        ol,
        controls,
        callback,
    );
    getVector_(
        `/api/events/polygons/within/${bbox.join('/')}/?start=${dateStart}&end=${dateEnd}${regionParam}`,
        ol.eventsLoaded,
        ol.eventsByDate,
        ol.eventsStoredByDate,
        ol.events_part_req,
        ol.eventLayer.getSource(),
        ol,
        controls,
        callback,
    );
}

/**
 * Fill ol.clusterLayer with the currently relevant objects, from cache and online resources.
 * @param ol: OlObjects
 * @param controls: Controls
 * @param callback: (filtered: Feature[]) => void - filtered is the features not previously existing in the layer.
 */
function getCluster(
    ol: OlObjects,
    controls: Controls,
    callback: (points: PointApi) => void,
): void {
    let dateStart = controls.dateStart.value as string;
    let dateEnd = controls.dateEnd.value as string;
    let regionParam = "";
    let region_s = controls.regionSelector.value
    if (region_s) {
        let region = parseInt(region_s, 10);
        regionParam = `&region=${controls.regionSelector.value}`
        if (region in ASSOCIATED_REGIONS) {
            regionParam += `,${ASSOCIATED_REGIONS[region].join(',')}`
        }
    }
    let url = `/api/events/points/?start=${dateStart}&end=${dateEnd}${regionParam}`

    let closure = (responseText: string) => {
        let json: PointApi = JSON.parse(responseText);
        ol.points = json;

        let clusterSource = new VectorSource();
        Object.entries(ol.regionCenters).forEach(([region, center]) => {
            if (json.regions[region]) {
                center.set("size", json.regions[region]);
                clusterSource.addFeature(center);
            }
        });
        ol.clusterLayer.setSource(clusterSource);
        return callback(json);
    };

    get(url, ol.cluster_all_req, (responseText) => closure(responseText));
}

/**
 * Remove irrelevant features from ol.eventLayer and ol.clusterLayer.
 * @param skipDates: boolean - Do not filter features based on the selected daterange
 * @param skipRegions: boolean - Do not filter features based on the selected region
 * @param ol: OlObjects
 * @param controls: Controls
 */
function resetVectors(skipDates: boolean, skipRegions: boolean, ol: OlObjects, controls: Controls): void {
    [
        ol.events_part_req,
        ol.cluster_all_req
    ].forEach((req) => {
        if (req[0]) {
            req[0].abort();
            req[0] = null;
        }
    });
    ol.eventsLoaded[0] = false;
    ol.clusterLayer.getSource().clear()

    let clear = false;

    if (!skipDates) {
        let startDate = new Date(controls.dateStart.value);
        let endDate = new Date(controls.dateEnd.value);
        for (let dateString of Object.keys(ol.eventsByDate)) {
            let date = new Date(dateString);
            if (date.getTime() < startDate.getTime() || date.getTime() >= endDate.getTime()) {
                if (dateString in ol.eventsByDate) delete ol.eventsByDate[dateString];
                clear = true;
            }
        }
    }

    if (!skipRegions) {
        let features = [];
        for (let dateString of Object.keys(ol.eventsByDate)) {
            for (let id of Object.keys(ol.eventsByDate[dateString])) {
                features.push(ol.eventsByDate[dateString][id]);
            }
        }
        let featuresToRemove = filterArrayByRegions_(features, false, controls, ol);
        featuresToRemove.forEach((feature) => {
            let date = getDate(db2Date(feature.get("skredTidspunkt")));
            let id = feature.get("skredID");
            delete ol.eventsByDate[date][id];
            if (!Object.keys(ol.eventsByDate[date]).length) delete ol.eventsByDate[date];
            clear = true;
        });
    }

    if (clear) {
        ol.clusterLayer.getSource().clear();
        ol.eventLayer.getSource().clear();
        for (let dateString of Object.keys(ol.eventsByDate)) {
            for (let id of Object.keys(ol.eventsByDate[dateString])) {
                ol.eventLayer.getSource().addFeature(ol.eventsByDate[dateString][id]);
            }
        }
    }
}

/**
 * Set layers/popup as un/visible and store location to cookies.
 * @param ol: OlObjects
 */
function updateMapState(ol: OlObjects): void {
    let zoomLevel = ol.map.getView().getZoom();
    let coordinates = ol.map.getView().getCenter();
    if (zoomLevel < CLUSTER_THRESHOLD) {
        ol.eventLayer.setVisible(false);
        ol.selectedEventLayer.setVisible(false);
        ol.clusterLayer.setVisible(true);
    } else {
        ol.eventLayer.setVisible(true);
        ol.selectedEventLayer.setVisible(true);
        ol.clusterLayer.setVisible(false);
    }

    Cookie.setCookie("zoomLevel", zoomLevel.toString(), Cookie.TTL);
    Cookie.setCookie("eastings", coordinates[0].toString(), Cookie.TTL);
    Cookie.setCookie("northings", coordinates[1].toString(), Cookie.TTL);

    let popupPosition = ol.popupOverlay[0].getPosition();
    let extent = ol.map.getView().calculateExtent();
    if (popupPosition && !containsCoordinate(extent, popupPosition)) {
        Popup.setPopup(undefined, null, ol);
    }
}

/**
 * Add selected region to ol.selectedRegionLayer.
 * @param ol: OlObjects
 * @param controls: Controls
 */
function selectRegion(ol: OlObjects, controls: Controls): void {
    let id_s = controls.regionSelector.value;
    let source = ol.selectedRegionLayer.getSource();
    source.clear();
    if (id_s) {
        let id = parseInt(id_s, 10);
        source.addFeature(ol.regions[id]);
        ASSOCIATED_REGIONS[id]?.forEach((subId) => {
            source.addFeature((ol.regions[subId]))
        })
    }
}

/**
 * Pan to selected region, IFF it is not in view.
 * @param controls: Controls
 * @param ol: OlObjects
 */
function panToRegion(controls: Controls, ol: OlObjects): void {
    let name = controls.regionSelector.value;
    if (name) {
        let geometry = ol.regions[parseInt(name, 10)].getGeometry();
        let viewExtent: Extent = ol.map.getView().calculateExtent();
        if (!geometry.intersectsExtent(viewExtent)) {
            ol.map.getView().fit(geometry.getExtent(), {duration: 700});
        }
    }
}

/**
 * Get precision in hours from a feature.
 * @param feature: Feature
 * @return number
 */
function getPrecision(feature: FeatureLike): number {
    let intervals: Record<string, number> = {
        'Eksakt': 0,
        '1 min': 1 / 60,
        '1 time': 1,
        '4 timer': 4,
        '6 timer': 6,
        '12 timer': 12,
        '1 dag': 24,
        '1 dager': 24,
        '2 dager': 48,
        '3 dager': 72,
    };
    return intervals[feature.get('noySkredTidspunkt')];
}

function getVector_(
    part_url: string,
    isLoaded: [boolean],
    existMap: Record<string, Record<string, Feature>>,
    cacheMap: Record<string, Record<string, Feature>>,
    part_req: [XMLHttpRequest | null],
    source: VectorSource,
    ol: OlObjects,
    controls: Controls,
    callback: (features: Feature[], complete: boolean) => void,
): void {
    if (isLoaded[0]) return;

    let closure = (responseText: string, complete: boolean) => {
        let d = new Date();
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let newEvents: Feature[] = [];

        d = new Date();
        let geoJson = new GeoJSON();

        yieldingForEach(json.features, 100, (geoJsonFeature: GeoJSONFeature) => {
            let dateString = getDate(db2Date(geoJsonFeature.properties.skredTidspunkt));
            let id = geoJsonFeature.properties.skredID;
            let exists = existMap[dateString] && existMap[dateString][geoJsonFeature.properties.skredID];
            if (!exists) {
                let feature = geoJson.readFeature(geoJsonFeature) as Feature<Polygon>;
                if (!(dateString in cacheMap)) cacheMap[dateString] = {};
                cacheMap[dateString][id] = feature;
                newEvents.push(cacheMap[dateString][id]);
            }
        }, () => {
            d = new Date();
            filter_(newEvents, source, existMap, controls, ol, (features) => {
                return callback(features, complete);
            });
        });
    };

    get(part_url, part_req, (responseText) => closure(responseText, false));
}

function recallVector_(
    dates: string[],
    existMap: Record<string, Record<string, Feature>>,
    cacheMap: Record<string, Record<string, Feature>>,
    source: VectorSource,
    ol: OlObjects,
    controls: Controls,
    callback: (features: Feature[], complete: boolean) => void,
): void {
    let newEvents: Feature[] = [];
    dates.forEach((dateString) => {
        if (cacheMap[dateString]) for (let id of Object.keys(cacheMap[dateString])) {
            let feature = cacheMap[dateString][id];
            if (!existMap[dateString] || !existMap[dateString][feature.get("skredID")]) {
                newEvents.push(feature);
            }
        }
    });

    filter_(newEvents, source, existMap, controls, ol, (features) => {
        return callback(features, false);
    });
}

function filter_(
    newEvents: Feature[],
    source: VectorSource,
    existMap: Record<string, Record<string, Feature>>,
    controls: Controls,
    ol: OlObjects,
    callback: (features: Feature[]) => void
) {
    let filtered = filterArrayByRegions_(newEvents, true, controls, ol);
    filtered.forEach((feature) => {
        let dateString = getDate(db2Date(feature.get("skredTidspunkt")));
        if (!(dateString in existMap)) existMap[dateString] = {};
        existMap[dateString][feature.get("skredID")] = feature;
        feature.setId(feature.get("skredID"));
    });
    source.addFeatures(filtered);
    callback(filtered);
}

function getRegions_(controls: Controls, ol: OlObjects) {
    let url = '/static/geojson/areas.json';
    get(url, [null], responseText => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let features = new GeoJSON({}).readFeatures(json);
        let regionIdName: [number, string][] = [];
        features.forEach((feature) => {
            let id = feature.get("omradeID");
            let name = feature.get("omradeNavn");
            ol.regions[parseInt(id)] = feature;
            regionIdName.push([id, name]);
            ol.regionCenters[id] = new GeoJSON({})
                .readFeature(turf.centerOfMass(JSON.parse(new GeoJSON({}).writeFeature(feature))));
        });
        regionIdName = regionIdName.sort((tup1, tup2) => {
            return tup1[1].localeCompare(tup2[1], 'no-NO');
        });
        regionIdName.forEach(([id, name]) => {
            addRegion(id, name, controls, ol);
        });
        ol.regionLayer.getSource().addFeatures(features);
        controls.regionSelector.dispatchEvent(new Event('input'));
    });
}

function filterArrayByRegions_(array: Feature[], keep: boolean, controls: Controls, ol: OlObjects): Feature[] {
    let filter = (id_s: string) => array.map((feature: Feature<Geometry>) => {
        let storedRegion = feature.get("regionId");
        if ((storedRegion == id_s) == keep) {
            return feature;
        }
    }).filter(Boolean);
    let id_s = controls.regionSelector.value;
    if (id_s) {
        let filtered = filter(id_s);
        let id = parseInt(id_s, 10)
        ASSOCIATED_REGIONS[id]?.forEach(subId => {
            filtered = filtered.concat(filter(subId.toString()));
        })
        return filtered;
    } else if (keep) {
        return array;
    } else {
        return [];
    }
}

export {
    CLUSTER_THRESHOLD,
    OlObjects,
    PointApi,
    initMap,
    getEvents,
    resetVectors,
    getCluster,
    updateMapState,
    selectRegion,
    panToRegion,
    getPrecision,
};