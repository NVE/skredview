import {OlObjects} from "../ol";
import {TIME_FORMAT} from "../date";
import Feature from "ol/Feature";
import {Coordinate} from "ol/coordinate";
import Overlay from "ol/Overlay";
import GeoJSON from "ol/format/GeoJSON";

const EXPOSITIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const EXPOSITIONS_NO = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];

function setPopup(coordinate: Coordinate, feature: Feature, ol: OlObjects) {
    let [overlay, content] = ol.popupOverlay;
    overlay.setPosition(coordinate);
    while (content.firstChild) content.firstChild.remove();
    ol.selectedEventLayer.getSource().clear();
    if (feature) {
        content.appendChild(formatEventInfo_(feature));
        ol.selectedEventLayer.getSource().addFeature(feature);
    }
}

function createPopupOverlay(ol: OlObjects): [Overlay, HTMLDivElement] {
    let container = document.getElementById('popup');
    let content = document.getElementById('popup-content') as HTMLDivElement;
    let closer = document.getElementById('popup-closer');

    let overlay = new Overlay({
        element: container,
        autoPan: false,
    });

    closer.onclick = function() {
        setPopup(undefined, null, ol);
        closer.blur();
        return false;
    };

    return [overlay, content];
}

function formatEventInfo_(event: Feature): HTMLDivElement {
    let container = document.createElement("div");

    let htmlText: string[] = [];
    let title = (text: string) => `<span class="bold">${text}</span>`;
    let precision = (dbText: string) => ({
        "4 timer": 4,
        "6 timer": 6,
        "12 timer": 12,
        "1 dager": 24,
        "2 dager": 48,
        "3 dager": 72,
    } as Record<string, number>)[dbText];
    let status = (dbText: string) => ({
        "Godkjent kvalitet A": "Approved quality A",
        "Godkjent kvalitet B": "Approved quality B",
    } as Record<string, string>)[dbText];

    let avalId = event.get("skredID");
    let avalDate = event.get("skredTidspunkt");
    let precAvalDate = event.get("noySkredTidspunkt");
    let aspect = event.get("eksposisjonUtlosningsomr");
    let area = event.get("area");
    let stopHeight = event.get("hoydeStoppSkred_moh");
    let precStopHeight = event.get("noyHoydeStoppSkred");
    let regStatus = event.get("regStatus");
    let regDate = event.get("registrertDato");
    let changeDate = event.get("endretDato");
    let meanSlope = event.get("snittHelningUtlopssomr_gr");
    let minSlope = event.get("minHelningUtlopsomr_gr");
    let maxSlope = event.get("maksHelningUtlopsomr_gr");

    let aspectIdx = EXPOSITIONS_NO.indexOf(aspect);

    if (avalId) htmlText.push(`${title("Avalanche ID:")} ${avalId}`);
    if (avalDate) {
        let dateString = new Date(avalDate).toLocaleDateString("no-NO", TIME_FORMAT);
        if (precAvalDate) dateString += ` ± ${precision(precAvalDate)}&nbsph`;
        htmlText.push(`${title("Triggered:")} ${dateString}`);
    }
    if (aspectIdx != -1) htmlText.push(`${title("Exposition:")} ${EXPOSITIONS[aspectIdx]}`);
    if (area) htmlText.push(`${title("Area:")} ${Math.round(area)}&nbspm²`);
    if (stopHeight) {
        let height = `${stopHeight}&nbspm.a.s.l.`;
        if (precStopHeight) height = `${height} ± ${precStopHeight.slice(0, -1)}&nbspm.`;
        htmlText.push(`${title("Stop height:")} ${height}`);
    }
    if (meanSlope) htmlText.push(`${title("Mean slope:")} ${meanSlope}º`);
    if (minSlope !== null && maxSlope !== null) {
        htmlText.push(`${title("Slope:")} ${maxSlope}º–${minSlope}º`);
    }
    if (regStatus) htmlText.push(`${title("Registration:")} ${status(regStatus)}`);
    if (regDate) {
        let dateString = new Date(regDate).toLocaleDateString("no-NO", TIME_FORMAT);
        htmlText.push(`${title("Registered:")} ${dateString}`);
    }
    if (changeDate && regDate != changeDate) {
        let dateString = new Date(changeDate).toLocaleDateString("no-NO", TIME_FORMAT);
        htmlText.push(`${title("Last edited:")} ${dateString}`);
    }

    container.innerHTML = htmlText.join("<br>\n") + "<br>\n";

    let clipboardRef = document.createElement("a");
    clipboardRef.href="#";
    clipboardRef.innerHTML = "Click to copy feature.";
    clipboardRef.onclick = () => {
        let jsonFeature = new GeoJSON().writeFeatureObject(event);
        navigator.clipboard.writeText(JSON.stringify(jsonFeature, null, 4)).then(() => {
            clipboardRef.innerHTML = "Feature copied to clipboard!";
        }, () => {
            clipboardRef.innerHTML = "Failed to copy to clipboard!";
        });
        return false;
    };
    container.appendChild(clipboardRef);

    return container;
}

export {setPopup, createPopupOverlay};