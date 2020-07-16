import * as Controls from "./controls";
import * as Ol from "./ol";
import {FeatureCollection} from "geojson";

let controls = Controls.initControls();
let currentDateStart = new Date(controls.dateStart.value as string);
let currentDateEnd = new Date(controls.dateEnd.value as string);
let olObjects = Ol.initMap(controls);

controls.dateStart.oninput = () => {
    let clear = new Date(controls.dateStart.value as string) > currentDateStart;
    Ol.resetVectors(olObjects, clear);
    [currentDateStart, currentDateEnd] =  Controls.adjustRangeStart(currentDateStart, currentDateEnd);
    Ol.getCluster(olObjects, controls);
    Ol.getEvents(olObjects, controls);
};

controls.dateEnd.oninput = () => {
    let clear = new Date(controls.dateEnd.value as string) < currentDateEnd;
    Ol.resetVectors(olObjects, clear);
    [currentDateStart, currentDateEnd] = Controls.adjustRangeEnd(currentDateStart);
    Ol.getCluster(olObjects, controls);
    Ol.getEvents(olObjects, controls);
};

controls.regionSelector.onchange = () => {
    Ol.panToRegion(controls, olObjects);
};
controls.regionSelector.oninput = () => {
    Ol.resetVectors(olObjects, true);
    Controls.adjustRegion(olObjects, controls);
    Ol.selectRegion(olObjects, controls);
    Ol.getCluster(olObjects, controls);
    Ol.getEvents(olObjects, controls);
};

olObjects.map.on('moveend', () => {
    Ol.getCluster(olObjects, controls);
    Ol.getEvents(olObjects, controls);
    Ol.updateMapState(olObjects);
});