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

interface OlObjects {
    // Ol Map object
    map: Map,

    // Record of avalanche polygons displayed on the map. eventsByDate['yyyy-mm-dd'][uuid]
    eventsByDate: Record<string, Record<string, Feature>>,
    // Record of avalanche point geometries displayed on the map. clustersByDate['yyyy-mm-dd'][uuid]
    clustersByDate: Record<string, Record<string, Feature>>,

    // Record cache of all avalanche polygons ever seen. eventStoredsByDate['yyyy-mm-dd'][uuid]
    eventsStoredByDate: Record<string, Record<string, Feature>>,
    // Record cache of all point geometries ever seen. clustersStoredsByDate['yyyy-mm-dd'][uuid]
    clustersStoredByDate: Record<string, Record<string, Feature>>,

    // Indicates if the event layer has started loading.
    eventsLoaded: [boolean],
    // Indicates if the event layer has loaded completely.
    eventsLoadStart: [boolean],

    // Indicates if the cluster layer has started loading.
    clusterLoaded: [boolean],
    // Indicates if the cluster layer has loaded completelyz
    clusterLoadStart: [boolean],

    // XHR used to load the event layer within frame.
    events_part_req: [XMLHttpRequest | null],
    // XHR used to load the event layer completely.
    events_all_req: [XMLHttpRequest | null],
    // XHR used to load the cluster layer within frame.
    cluster_part_req: [XMLHttpRequest | null],
    // XHR used to load the cluster layer completely.
    cluster_all_req: [XMLHttpRequest | null],

    // Keeps track of the number of times basemap tiles has failed to load.
    backoff_counter_bw: Record<string, number>,
    backoff_counter_color: Record<string, number>,

    // Map of regions by their numerical IDs.
    regions: Record<number, Feature>,

    baseLayerBw: TileLayer,
    baseLayerColor: TileLayer,
    regionLayer: VectorImageLayer,
    // Layer containing currently selected region.
    selectedRegionLayer: VectorImageLayer,
    // Avalanche polygon layer.
    eventLayer: VectorImageLayer,
    // Avalanche cluster layer.
    clusterLayer: VectorImageLayer,
    // Layer containing the avalanche polygon currently shown in the popup.
    selectedEventLayer: VectorImageLayer,
    // Popup overlay.
    popupOverlay: [Overlay, HTMLDivElement],
}

const CLUSTER_THRESHOLD = 11;

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

    let baseLayerBw = Layer.createBaseLayer('topo4graatone', backoff_counter_bw);
    baseLayerBw.setZIndex(0);
    let fakeBaseLayer = new TileLayer();
    fakeBaseLayer.set('title', 'Grayscale Topo Map');
    fakeBaseLayer.set('type', 'base');

    let baseLayerColor = Layer.createBaseLayer('topo4', backoff_counter_color);
    baseLayerColor.set('title', 'Color Topo Map');
    baseLayerColor.set('type', 'base');
    baseLayerColor.on("change:visible", (e) => {
        baseLayerBw.setVisible(!e.target.get(e.key));
    });

    let baseLayerOrtho = Layer.createOrthoLayer();
    baseLayerOrtho.set('title', 'Orthophoto');
    baseLayerOrtho.set('type', 'base');

    let slopeUrl = 'https://gis3.nve.no/map/rest/services/Bratthet/MapServer';
    let slopeLayer = Layer.createNveLayer(slopeUrl, 'show:0,1');
    slopeLayer.setVisible(false)
    slopeLayer.set('title', 'Slope');


    let dangerUrl = 'https://gis3.nve.no/map/rest/services/SkredSnoAktR/MapServer';
    let dangerGroup = new Group({
        visible: false,
        layers: [
            Layer.createNveLayer(dangerUrl, 'show:0'),
            Layer.createNveLayer(dangerUrl, 'show:1,2'),
        ]
    });
    dangerGroup.getLayers().getArray()[0].setMaxZoom(13.75773);
    dangerGroup.getLayers().getArray()[1].setMinZoom(13.75773);
    let fakeDangerLayer = new ImageLayer({
        visible: false
    });
    fakeDangerLayer.set('title', 'Danger zones');
    fakeDangerLayer.on("change:visible", (e) => {
        dangerGroup.setVisible(e.target.get(e.key));
    });

    let regionLayer = Layer.createRegionLayer();
    let selectedRegionLayer = Layer.createSelectedRegionLayer();
    let eventLayer = Layer.createEventLayer();
    let selectedEventLayer = Layer.createEventLayer();
    let clusterLayer = Layer.createClusterLayer();
    selectedEventLayer.setOpacity(1);
    selectedEventLayer.setZIndex(6);

    let baseGroup = new Group({
        layers: [
            baseLayerOrtho,
            baseLayerColor,
            fakeBaseLayer,
            baseLayerBw,
        ]
    });
    baseGroup.set('title', 'Baselayers');
    let extraGroup = new Group({
        layers: [
            fakeDangerLayer,
            dangerGroup,
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
        clustersByDate,
        eventsStoredByDate,
        clustersStoredByDate,
        eventsLoaded: [false],
        eventsLoadStart: [false],
        clusterLoaded: [false],
        clusterLoadStart: [false],
        events_part_req: [null],
        events_all_req: [null],
        cluster_part_req: [null],
        cluster_all_req: [null],
        backoff_counter_bw,
        backoff_counter_color,
        regions,
        baseLayerBw,
        baseLayerColor,
        regionLayer,
        selectedRegionLayer,
        eventLayer,
        clusterLayer,
        selectedEventLayer,
        popupOverlay: null,
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
        `/api/events/polygons/within/${bbox.join('/')}/?start=${dateStart}&end=${dateEnd}`,
        `/api/events/polygons/?start=${dateStart}&end=${dateEnd}`,
        ol.eventsLoaded,
        ol.eventsLoadStart,
        ol.eventsByDate,
        ol.eventsStoredByDate,
        ol.events_part_req,
        ol.events_all_req,
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
    callback: (filtered: Feature[], complete: boolean) => void,
): void {
    let dateStart = controls.dateStart.value as string;
    let dateEnd = controls.dateEnd.value as string;
    let bbox = ol.map.getView().calculateExtent();
    let clusterSource = ol.clusterLayer.getSource() as Cluster;
    recallVector_(
        dateRange(new Date(controls.dateStart.value), new Date(controls.dateEnd.value)),
        ol.clustersByDate,
        ol.clustersStoredByDate,
        clusterSource.getSource(),
        ol,
        controls,
        callback,
    );
    getVector_(
        `/api/events/points/within/${bbox.join('/')}/?start=${dateStart}&end=${dateEnd}`,
        `/api/events/points/?start=${dateStart}&end=${dateEnd}`,
        ol.clusterLoaded,
        ol.clusterLoadStart,
        ol.clustersByDate,
        ol.clustersStoredByDate,
        ol.cluster_part_req,
        ol.cluster_all_req,
        clusterSource.getSource(),
        ol,
        controls,
        callback,
    );
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

    let clear = false;

    if (!skipDates) {
        let startDate = new Date(controls.dateStart.value);
        let endDate = new Date(controls.dateEnd.value);
        for (let dateString of Object.keys(ol.clustersByDate)) {
            let date = new Date(dateString);
            if (date.getTime() < startDate.getTime() || date.getTime() >= endDate.getTime()) {
                delete ol.clustersByDate[dateString];
                if (dateString in ol.eventsByDate) delete ol.eventsByDate[dateString];
                clear = true;
            }
        }
    }

    if (!skipRegions) {
        let features = [];
        for (let dateString of Object.keys(ol.clustersByDate)) {
            for (let id of Object.keys(ol.clustersByDate[dateString])) {
                features.push(ol.clustersByDate[dateString][id]);
            }
        }
        let featuresToRemove = filterArrayByRegions_(features, false, controls, ol);
        featuresToRemove.forEach((feature) => {
            let date = getDate(db2Date(feature.get("skredTidspunkt")));
            let id = feature.get("skredID");
            delete ol.clustersByDate[date][id];
            if (!Object.keys(ol.clustersByDate[date]).length) delete ol.clustersByDate[date];
            if (date in ol.eventsByDate && id in ol.eventsByDate[date]) delete ol.eventsByDate[date][id];
            if (date in ol.eventsByDate && !Object.keys(ol.eventsByDate[date]).length) delete ol.eventsByDate[date];
            clear = true;
        });
    }

    if (clear) {
        let clusterSource = ol.clusterLayer.getSource() as Cluster;
        clusterSource.getSource().clear();
        ol.eventLayer.getSource().clear();
        for (let dateString of Object.keys(ol.eventsByDate)) {
            for (let id of Object.keys(ol.eventsByDate[dateString])) {
                ol.eventLayer.getSource().addFeature(ol.eventsByDate[dateString][id]);
            }
        }
        for (let dateString of Object.keys(ol.clustersByDate)) {
            for (let id of Object.keys(ol.clustersByDate[dateString])) {
                clusterSource.getSource().addFeature(ol.clustersByDate[dateString][id]);
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
    let name = controls.regionSelector.value;
    let source = ol.selectedRegionLayer.getSource();
    source.clear();
    if (name) source.addFeature(ol.regions[parseInt(name, 10)]);
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
    all_url: string,
    isLoaded: [boolean],
    isStarted: [boolean],
    existMap: Record<string, Record<string, Feature>>,
    cacheMap: Record<string, Record<string, Feature>>,
    part_req: [XMLHttpRequest | null],
    all_req: [XMLHttpRequest | null],
    source: VectorSource,
    ol: OlObjects,
    controls: Controls,
    callback: (features: Feature[], complete: boolean) => void,
): void {
    if (isLoaded[0]) return;

    let closure = (responseText: string, complete: boolean) => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let newEvents: Feature[] = [];

        let geoJson = new GeoJSON();
        json.features.forEach((geoJsonFeature: GeoJSONFeature) => {
            let dateString = getDate(db2Date(geoJsonFeature.properties.skredTidspunkt));
            let id = geoJsonFeature.properties.skredID;
            let exists = existMap[dateString] && existMap[dateString][geoJsonFeature.properties.skredID];
            if (!exists) {
                let feature = geoJson.readFeature(geoJsonFeature) as Feature<Polygon>;
                if (!(dateString in cacheMap)) cacheMap[dateString] = {};
                cacheMap[dateString][id] = feature;
                newEvents.push(cacheMap[dateString][id]);
            }
        });

        filter_(newEvents, source, existMap, controls, ol, (features) => {
            return callback(features, complete);
        });
    };

    get(part_url, part_req, (responseText) => closure(responseText, false));
    if (!isStarted[0]) {
        isStarted[0] = true;
        get(all_url, all_req, (responseText) => {
            isLoaded[0] = true;
            closure(responseText, true);
        });
    }
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
        });
        regionIdName = regionIdName.sort((tup1, tup2) => {
            return tup1[1].localeCompare(tup2[1], 'no-NO');
        });
        regionIdName.forEach(([id, name]) => {
            addRegion(id, name, controls, ol);
        });
        ol.regionLayer.getSource().addFeatures(features);
    });
}

function filterArrayByRegions_(array: Feature[], keep: boolean, controls: Controls, ol: OlObjects): Feature[] {
    let name = controls.regionSelector.value;
    if (name) {
        let geometry = ol.regions[parseInt(name, 10)].getGeometry();
        let geoJson = new GeoJSON();
        let geoJsonRegion = geoJson.writeGeometryObject(geometry) as turf.GeometryObject;
        return array.map((feature) => {
            let storedRegion = feature.get("region");
            let storedNotRegion: string[] = feature.get("notRegion");
            if (storedRegion) {
                if ((storedRegion == name) == keep ) {
                    return feature;
                }
            } else if (!keep && storedNotRegion && storedNotRegion.indexOf(name) != -1) {
                return feature;
            } else if (!storedNotRegion || storedNotRegion.indexOf(name) == -1) {
                let date = getDate(db2Date(feature.get("skredTidspunkt")));
                let id = feature.get("skredID");
                let evalFeature = feature;
                if (date in ol.clustersByDate && id in ol.clustersByDate[date]) {
                    evalFeature = ol.clustersByDate[date][id];
                }
                let geoJsonEvent = geoJson.writeGeometryObject(evalFeature.getGeometry()) as turf.GeometryObject;
                let within = turf.booleanWithin(geoJsonEvent, geoJsonRegion);
                if (within) {
                    feature.set("region", name);
                } else if (storedNotRegion) {
                    storedNotRegion.push(name);
                } else {
                    feature.set("notRegion", [name]);
                }
                if (within == keep) return feature;
            }
        }).filter(Boolean);
    } else if (keep) {
        return array;
    } else {
        return [];
    }
}

export {
    CLUSTER_THRESHOLD,
    OlObjects,
    initMap,
    getEvents,
    resetVectors,
    getCluster,
    updateMapState,
    selectRegion,
    panToRegion,
    getPrecision,
};