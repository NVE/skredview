import {OlObjects} from "../ol";
import {TIME_FORMAT, db2Date} from "../date";
import Feature from "ol/Feature";
import {Coordinate} from "ol/coordinate";
import Overlay from "ol/Overlay";
import GeoJSON from "ol/format/GeoJSON";

const EXPOSITIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

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

    let htmlText: [string, string][] = [];
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
        "Godkjent kvalitet C": "Approved quality C",
    } as Record<string, string>)[dbText];

    let avalId = event.get("skredID");
    let avalDate = db2Date(event.get("skredTidspunkt"));
    let precAvalDate = event.get("noySkredTidspunkt");
    let aspect = parseInt(event.get("eksposisjonUtlopsomr"), 10);
    let area = Math.round(event.get("area")).toLocaleString("no-NO");
    let stopHeight = Math.round(event.get("hoydeStoppSkred_moh")).toLocaleString("no-NO");
    let precStopHeight = event.get("noyHoydeStoppSkred");
    let regStatus = event.get("regStatus");
    let regDate = db2Date(event.get("registrertDato"));
    let changeDate = db2Date(event.get("endretDato"));
    let meanSlope = Math.round(event.get("snittHelningUtlopssomr_gr")).toLocaleString("no-NO");
    let minSlope = Math.round(event.get("minHelningUtlopsomr_gr")).toLocaleString("no-NO");
    let maxSlope = Math.round(event.get("maksHelningUtlopsomr_gr")).toLocaleString("no-NO");

    let aspectIdx = !isNaN(aspect) ? (Math.floor((aspect + 22.5) / (360 / 8)) % 8 + 8) % 8 : -1;

    if (avalId) htmlText.push(["Avalanche ID:", avalId]);
    if (avalDate) {
        let dateString = avalDate.toLocaleDateString("no-NO", TIME_FORMAT);
        if (precAvalDate) dateString += ` ± ${precision(precAvalDate)}&nbsph`;
        htmlText.push(["Triggered:", dateString]);
    }
    if (aspectIdx != -1) htmlText.push(["Exposition:", EXPOSITIONS[aspectIdx]]);
    if (area) htmlText.push(["Area:", `${area}&nbspm²`]);
    if (stopHeight) {
        let height = `${stopHeight}&nbspm.a.s.l.`;
        if (precStopHeight) height = `${height} ± ${precStopHeight.slice(0, -1)}&nbspm.`;
        htmlText.push(["Stop height:", height]);
    }
    if (meanSlope) htmlText.push(["Mean slope:", `${meanSlope}º`]);
    if (minSlope !== null && maxSlope !== null) {
        htmlText.push(["Slope:", `${maxSlope}º–${minSlope}º`]);
    }
    if (regStatus) htmlText.push(["Registration:", status(regStatus)]);
    if (regDate) {
        let dateString = regDate.toLocaleDateString("no-NO", TIME_FORMAT);
        htmlText.push(["Registered:", dateString]);
    }
    if (changeDate && regDate != changeDate) {
        let dateString = changeDate.toLocaleDateString("no-NO", TIME_FORMAT);
        htmlText.push(["Last edited:", dateString]);
    }

    container.innerHTML = `<table>${htmlText.map((row) =>
        `<tr><th>${row[0]}</th><td>${row[1]}</td></tr>`
    ).join("\n")}</table>`;

    if (navigator.clipboard) {
        let clipboardRef = document.createElement("a");
        clipboardRef.href = "#";
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
    }

    return container;
}

export {setPopup, createPopupOverlay};