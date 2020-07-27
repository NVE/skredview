import {addRegion, Controls} from "./controls";
import {dateRange, getDate} from "./date";
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
import * as turf from '@turf/turf';
import Polygon from "ol/geom/Polygon";

interface OlObjects {
    map: Map,
    eventsByDate: Record<string, Record<string, Feature>>,
    clustersByDate: Record<string, Record<string, Feature>>,
    eventsStoredByDate: Record<string, Record<string, Feature>>,
    clustersStoredByDate: Record<string, Record<string, Feature>>,
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
    regionLayer: VectorImageLayer,
    selectedRegionLayer: VectorImageLayer,
    eventLayer: VectorImageLayer,
    clusterLayer: VectorImageLayer,
    selectedEventLayer: VectorImageLayer,
    popupOverlay: [Overlay, HTMLDivElement],
}

const CLUSTER_THRESHOLD = 11;

function initMap(controls: Controls): OlObjects {
    let eventsByDate: Record<string, Record<string, Feature>> = {};
    let clustersByDate: Record<string, Record<string, Feature>> = {};
    let eventsStoredByDate: Record<string, Record<string, Feature>> = {};
    let clustersStoredByDate: Record<string, Record<string, Feature>> = {};
    let regions: Record<string, Feature> = {};
    let backoff_counter: Record<string, number> = {};

    let baseLayer = Layer.createBaseLayer(backoff_counter);
    let regionLayer = Layer.createRegionLayer();
    let selectedRegionLayer = Layer.createSelectedRegionLayer();
    let eventLayer = Layer.createEventLayer();
    let selectedEventLayer = Layer.createEventLayer();
    let clusterLayer = Layer.createClusterLayer();
    selectedEventLayer.setOpacity(1);
    selectedEventLayer.setZIndex(5);

    let layers = [
        baseLayer,
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
        backoff_counter,
        regions,
        baseLayer,
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

    let url = '/static/geojson/areas.json';
    get(url, [null], responseText => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let features = new GeoJSON({}).readFeatures(json);
        let regionIdName: [number, string][] = [];
        features.forEach((feature) => {
            let id = feature.get("omradeID");
            let name = feature.get("omradeNavn");
            regions[id] = feature;
            regionIdName.push([id, name]);
        });
        regionIdName = regionIdName.sort((tup1, tup2) => {
            return tup1[1].localeCompare(tup2[1], 'no-NO');
        });
        regionIdName.forEach(([id, name]) => {
            addRegion(id, name, controls, ol);
        });
        regionLayer.getSource().addFeatures(features);
    });

    updateMapState(ol);

    return ol;
}

function getEvents(
    ol: OlObjects,
    controls: Controls,
    callback: (filtered: Feature[]) => void,
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

function getCluster(
    ol: OlObjects,
    controls: Controls,
    callback: (filtered: Feature[]) => void,
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
            let date = getDate(new Date(feature.get("skredTidspunkt")));
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
            for (let id in ol.eventsByDate[dateString]) {
                ol.eventLayer.getSource().addFeature(ol.eventsByDate[dateString][id]);
            }
        }
        for (let dateString of Object.keys(ol.clustersByDate)) {
            for (let id in ol.clustersByDate[dateString]) {
                clusterSource.getSource().addFeature(ol.clustersByDate[dateString][id]);
            }
        }
    }
}

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
        let viewExtent: Extent = ol.map.getView().calculateExtent();
        if (!geometry.intersectsExtent(viewExtent)) {
            ol.map.getView().fit(geometry.getExtent(), {duration: 700});
        }
    }
}

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
    callback: (features: Feature[]) => void,
): void {
    if (isLoaded[0]) return;

    let closure = (responseText: string) => {
        let json: GeoJSONFeatureCollection = JSON.parse(responseText);
        let newEvents: Feature[] = [];

        let geoJson = new GeoJSON();
        json.features.forEach((geoJsonFeature: GeoJSONFeature) => {
            let dateString = getDate(new Date(geoJsonFeature.properties.skredTidspunkt));
            let id = geoJsonFeature.properties.skredID;
            let exists = existMap[dateString] && existMap[dateString][geoJsonFeature.properties.skredID];
            if (!exists) {
                let feature = geoJson.readFeature(geoJsonFeature) as Feature<Polygon>;
                if (!(dateString in cacheMap)) cacheMap[dateString] = {};
                cacheMap[dateString][id] = feature;
                newEvents.push(cacheMap[dateString][id]);
            }
        });

        let filtered = filterArrayByRegions_(newEvents, true, controls, ol);
        filtered.forEach((feature) => {
            let dateString = getDate(new Date(feature.get("skredTidspunkt")));
            if (!(dateString in existMap)) existMap[dateString] = {};
            existMap[dateString][feature.get("skredID")] = feature;
        });
        source.addFeatures(filtered);
        callback(filtered);
    };

    get(part_url, part_req, closure);
    if (!isStarted[0]) {
        isStarted[0] = true;
        get(all_url, all_req, (responseText) => {
            isLoaded[0] = true;
            closure(responseText);
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
    callback: (features: Feature[]) => void,
): void {
    let newEvents: Feature[] = [];
    dates.forEach((dateString) => {
        for (let id in cacheMap[dateString]) {
            let feature = cacheMap[dateString][id];
            if (!existMap[dateString] || !existMap[dateString][feature.get("skredID")]) {
                newEvents.push(feature);
            }
        }
    });

    let filtered = filterArrayByRegions_(newEvents, true, controls, ol);
    filtered.forEach((feature) => {
        let dateString = getDate(new Date(feature.get("skredTidspunkt")));
        if (!(dateString in existMap)) existMap[dateString] = {};
        existMap[dateString][feature.get("skredID")] = feature;
    });
    source.addFeatures(filtered);
    callback(filtered);
}

function filterArrayByRegions_(array: Feature[], keep: boolean, controls: Controls, ol: OlObjects): Feature[] {
    let name = controls.regionSelector.value;
    if (name) {
        let geometry = ol.regions[name].getGeometry();
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
                let date = getDate(new Date(feature.get("skredTidspunkt")));
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