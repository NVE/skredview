import {getPrecision, OlObjects} from "./ol";
import Feature from "ol/Feature";
import {EXPOSITIONS} from "./charts";

function calculateStatistics(ol: OlObjects): void {
    let div = document.getElementById("statistics");
    let statAvalanchesAll = document.getElementById("stat-avalanches-all");
    let statAvalanches24h = document.getElementById("stat-avalanches-24");
    let statSizeMedian = document.getElementById("stat-size-median");
    let statSizeMean = document.getElementById("stat-size-mean");
    let statSizeMin = document.getElementById("stat-size-min");
    let statSizeMax = document.getElementById("stat-size-max");
    let statAspectMedian = document.getElementById("stat-aspect-median");

    let events = [];
    for (let dateString of Object.keys(ol.eventsByDate)) {
        for (let id of Object.keys(ol.eventsByDate[dateString])) {
            events.push(ol.eventsByDate[dateString][id]);
        }
    }
    let len = events.length;
    if (!len) return;

    let areas = events.map((event: Feature) => parseInt(event.get("area"))).sort();
    let aspects = [0, 0, 0, 0, 0, 0, 0, 0];
    events.map((event: Feature) => {
        let aspect = parseInt(event.get("eksposisjonUtlopsomr"), 10);
        return !isNaN(aspect) ? (Math.floor((aspect + 22.5) / (360 / 8)) % 8 + 8) % 8 : null;
    }).filter((idx) => idx !== null).forEach((idx) => {
        aspects[idx] += 1;
    });
    let medianAspect = Math.max(...aspects) > 0 ? EXPOSITIONS[aspects.indexOf(Math.max(...aspects))] : "";

    let median = len % 2 == 0 ? (areas[len / 2] + areas[len / 2 - 1]) / 2 : areas[Math.floor(len / 2)];
    let mean = areas.reduce((x, y) => x + y) / (areas.length);
    statAvalanchesAll.innerText = events.length.toLocaleString("no-NO");
    statAvalanches24h.innerText = events.filter((event: Feature) => getPrecision(event) < 24)
        .length
        .toLocaleString("no-NO");
    statSizeMedian.innerText = Math.round(median).toLocaleString("no-NO");
    statSizeMean.innerText = Math.round(mean).toLocaleString("no-NO");
    statSizeMin.innerText = Math.round(Math.min(...areas)).toLocaleString("no-NO");
    statSizeMax.innerText = Math.round(Math.max(...areas)).toLocaleString("no-NO");
    statAspectMedian.innerText = medianAspect;
}

function clearStatistics(): void {
    document.getElementById("stat-avalanches-all").innerText = "";
    document.getElementById("stat-avalanches-24").innerText = "";
    document.getElementById("stat-size-median").innerText = "";
    document.getElementById("stat-size-mean").innerText = "";
    document.getElementById("stat-size-min").innerText = "";
    document.getElementById("stat-size-max").innerText = "";
    document.getElementById("stat-aspect-median").innerText = "";
}

export {calculateStatistics, clearStatistics}