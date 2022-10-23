import {getPrecision, OlObjects} from "./ol";
import Feature from "ol/Feature";
import {EXPOSITIONS} from "./charts";

function calculateStatistics(ol: OlObjects): void {
    let div = document.getElementById("statistics");
    let statAvalanchesAll = document.getElementById("stat-avalanches-all");
    let statAvalanches24h = document.getElementById("stat-avalanches-24");
    //let statSizeMedian = document.getElementById("stat-size-median");
    //let statSizeMean = document.getElementById("stat-size-mean");
    //let statSizeMin = document.getElementById("stat-size-min");
    //let statSizeMax = document.getElementById("stat-size-max");
    let statAspectMedian = document.getElementById("stat-aspect-median");

    //let areas = events.map((event: Feature) => parseInt(event.get("area"))).sort();
    let aspects = [0, 0, 0, 0, 0, 0, 0, 0];
    [
        ol.points.expositions_gt48,
        ol.points.expositions_lt24,
        ol.points.expositions_lte48,
    ].forEach((expositions) => {
        Object.entries(expositions).forEach(([aspect, amount]) => {
            aspects[parseInt(aspect)] += amount;
        })
    });

    let len = aspects.reduce((acc, val) => acc + val, 0);
    if (!len) return;

    let medianAspect = Math.max(...aspects) > 0 ? EXPOSITIONS[aspects.indexOf(Math.max(...aspects))] : "";



    //let median = len % 2 == 0 ? (areas[len / 2] + areas[len / 2 - 1]) / 2 : areas[Math.floor(len / 2)];
    //let mean = areas.reduce((x, y) => x + y) / (areas.length);
    statAvalanchesAll.innerText = len.toLocaleString("no-NO");
    statAvalanches24h.innerText = Object.values(ol.points.expositions_lt24)
        .reduce((acc, val) => acc + val, 0)
        .toLocaleString();
    //statSizeMedian.innerText = Math.round(median).toLocaleString("no-NO");
    //statSizeMean.innerText = Math.round(mean).toLocaleString("no-NO");
    //statSizeMin.innerText = Math.round(Math.min(...areas)).toLocaleString("no-NO");
    //statSizeMax.innerText = Math.round(Math.max(...areas)).toLocaleString("no-NO");
    statAspectMedian.innerText = medianAspect;
}

function clearStatistics(): void {
    document.getElementById("stat-avalanches-all").innerText = "";
    document.getElementById("stat-avalanches-24").innerText = "";
    //document.getElementById("stat-size-median").innerText = "";
    //document.getElementById("stat-size-mean").innerText = "";
    //document.getElementById("stat-size-min").innerText = "";
    //document.getElementById("stat-size-max").innerText = "";
    document.getElementById("stat-aspect-median").innerText = "";
}

export {calculateStatistics, clearStatistics}