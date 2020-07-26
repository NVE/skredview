import * as Controls from "./controls";
import * as Ol from "./ol";
import * as Charts from "./charts";
import * as Popup from "./ol/popup";
import Cluster from "ol/source/Cluster";
import Point from "ol/geom/Point";
import Feature from "ol/Feature";
import Polygon from "ol/geom/Polygon";
import {getDate} from "./controls";

document.addEventListener('DOMContentLoaded', () => {
    let controls = Controls.initControls();
    let currentDateStart = new Date(controls.dateStart.value as string);
    let currentDateEnd = new Date(controls.dateEnd.value as string);
    let ol = Ol.initMap(controls);
    let charts = Charts.initCharts(controls);
    let eventClosure = (features: Feature<Polygon>[]) =>{
        Charts.calculateTimelineEvent(features, charts, controls);
        Charts.calculateSize(features, charts, controls);
        Charts.calculateExposition(features, charts, controls);
    };
    let clusterClosure = (features: Feature[]) =>{
        Charts.calculateTimelineCluster(features, charts, controls);
    };
    Ol.getCluster(ol, controls, clusterClosure);
    Ol.getEvents(ol, controls, eventClosure);

    let dateChangeClosure = () => {
        Popup.setPopup(undefined, null, ol);
        Ol.resetVectors(false, true, ol, controls);
        Charts.updateTimelineDates(charts, controls, ol);
        Charts.clearSize(false, charts);
        Charts.clearExposition(false, charts);
        Charts.calculateSize(ol.eventLayer.getSource().getFeatures(), charts, controls);
        Charts.calculateExposition(ol.eventLayer.getSource().getFeatures(), charts, controls);
        Ol.getCluster(ol, controls, clusterClosure);
        Ol.getEvents(ol, controls, eventClosure);
    };
    controls.dateStart.oninput = () => {
        let dateStart = new Date(controls.dateStart.value);
        let dateEnd = new Date(controls.dateEnd.value);
        let dateStartMin = new Date(controls.dateStart.min);
        let dateStartMax = new Date(controls.dateStart.max);
        if (isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())
            || dateStart < dateStartMin || dateStart > dateStartMax
        ) return;

        let [oldDateStart, oldDateEnd] = [currentDateStart, currentDateEnd];
        [currentDateStart, currentDateEnd] = Controls.adjustRangeStart(oldDateStart, oldDateEnd);
        setTimeout(dateChangeClosure, 0);
    };

    controls.dateEnd.oninput = () => {
        let dateEnd = new Date(controls.dateEnd.value);
        let dateStart = new Date(controls.dateStart.value);
        let dateEndMin = new Date(controls.dateEnd.min);
        let dateEndMax = new Date(controls.dateEnd.max);
        if (isNaN(dateEnd.getTime()) || isNaN(dateEnd.getTime())
            || dateEnd <= dateStart
            || dateEnd < dateEndMin || dateEnd > dateEndMax
        ) return;

        let oldDateStart = currentDateStart;
        [currentDateStart, currentDateEnd] = Controls.adjustRangeEnd(oldDateStart);
        setTimeout(dateChangeClosure, 0);
    };

    controls.regionSelector.onchange = () => {
        Ol.panToRegion(controls, ol);
    };
    controls.regionSelector.oninput = () => {
        let dateEnd = new Date(controls.dateEnd.value);
        let dateStart = new Date(controls.dateStart.value);
        let dateStartMin = new Date(controls.dateStart.min);
        let dateStartMax = new Date(controls.dateStart.max);
        let dateEndMin = new Date(controls.dateEnd.min);
        let dateEndMax = new Date(controls.dateEnd.max);
        if (isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())
            || dateEnd <= dateStart
            || dateStart < dateStartMin || dateStart > dateStartMax
            || dateEnd < dateEndMin || dateEnd > dateEndMax
        ) {
            controls.dateStart.value = getDate(currentDateStart);
            controls.dateEnd.value = getDate(currentDateEnd);
        }

        Controls.adjustRegion(ol, controls);
        let selectedRegion = controls.regionSelector.value;
        setTimeout(() => {
            Ol.resetVectors(true, selectedRegion == "", ol, controls);
            Ol.selectRegion(ol, controls);
            if (selectedRegion != "") {
                let clustersource = (ol.clusterLayer.getSource() as Cluster);
                Charts.clearStatistics(false, charts);
                Charts.calculateTimelineEvent(ol.eventLayer.getSource().getFeatures(), charts, controls);
                Charts.calculateTimelineCluster(clustersource.getSource().getFeatures(), charts, controls);
                Charts.calculateSize(ol.eventLayer.getSource().getFeatures(), charts, controls);
                Charts.calculateExposition(ol.eventLayer.getSource().getFeatures(), charts, controls);
            }
            Ol.getCluster(ol, controls, clusterClosure);
            Ol.getEvents(ol, controls, eventClosure);
        }, 0);
    };

    ol.map.on('moveend', () => {
        Ol.getCluster(ol, controls, clusterClosure);
        Ol.getEvents(ol, controls, eventClosure);
        Ol.updateMapState(ol);
    });

    ol.map.on('singleclick', (event) => {
        let handled = false;
        ol.map.forEachFeatureAtPixel(event.pixel, (feature: Feature, layer) => {
            if (!handled && (layer == ol.eventLayer || layer == ol.selectedEventLayer)) {
                Popup.setPopup(event.coordinate, feature, ol);
                handled = true;
            } else if (!handled && ol.popupOverlay[0].getPosition()) {
                Popup.setPopup(undefined, null, ol);
                handled = true;
            } else if (!handled && layer == ol.clusterLayer) {
                let center = (feature.getGeometry() as Point).getCoordinates();
                ol.map.getView().setCenter(center);
                ol.map.getView().setZoom(Ol.CLUSTER_THRESHOLD);
                handled = true;
            } else if (!handled && layer == ol.selectedRegionLayer) {
                controls.regionSelector.value = "";
                controls.regionSelector.dispatchEvent(new Event("input"));
                handled = true;
            } else if (!handled && layer == ol.regionLayer) {
                controls.regionSelector.value = feature.get("label");
                controls.regionSelector.dispatchEvent(new Event("input"));
                handled = true;
            }
        });
    });
});