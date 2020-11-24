import * as Highcharts from 'highcharts';
import * as HighchartsMore from "highcharts/highcharts-more";
import {Controls} from "./controls";
import {dateRange, db2Date} from "./date";
import {COLORS, VECTOR_OPACITY} from "./color";
import {OlObjects, getPrecision} from "./ol";
import Feature from "ol/Feature";
HighchartsMore.default(Highcharts);

interface Charts {
    timeline: Highcharts.Chart,
    size: Highcharts.Chart,
    height: Highcharts.Chart,
    exposition: Highcharts.Chart,
}

const SIZE_CATEGORIES = ["< 10.000 m²", "< 50.000 m²", "< 100.000 m²", "< 500.000 m²", "≥ 500.000 m²"];
const DSIZE_CATEGORIES = ["D1", "D2", "D3", "D4", "D5"];
const EXPOSITIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const D_SIZE = "Debris Area";
const D_HEIGHT = "Debris Elevation";
const A_TIME = "Avalanche Timeline";
const EXPOSITION = "Debris Aspect";

/**
 * Create all the charts available in the page. Initializes all y-values to 0.
 * @param controls: Controls
 * @return Charts
 */
function initCharts(controls: Controls): Charts {
    let dates = dateRange(new Date(controls.dateStart.value), new Date(controls.dateEnd.value));
    let precBorderColor = new Highcharts.Color(COLORS.BORDER_EVENT.toString()).setOpacity(VECTOR_OPACITY).get();
    let sizeBorderColor = new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get();
    let precTooltipStyle = `color:{point.color}; stroke: ${precBorderColor}; font-size: 20px;`;
    let sizeTooltipStyle = `color:{point.color}; stroke: ${sizeBorderColor}; font-size: 20px;`;
    let basicTooltipStyle = `color:{point.color}; font-size: 20px;`;
    let timeline = Highcharts.chart('charts-timeline', {
        chart: {
            type: 'column',
            backgroundColor: COLORS.BACKGROUND,
            style: {
                fontFamily: 'Source Sans Pro, sans-serif',
            }
        },
        plotOptions: {
            column: {
                stacking: 'normal',
            },
            series: {
                events: {
                    legendItemClick: (event) => {
                        event.preventDefault();
                    }
                }
            }
        },
        title: {
            text: A_TIME,
            style: {
                fontSize: '24px',
            }
        },
        xAxis: {
            categories: dates,
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        yAxis: {
            allowDecimals: false,
            title: {
                text: 'Detected avalanches',
                style: {
                    fontSize: '20px',
                    fontWeight: '600',
                }
            },
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        legend: {
            itemStyle: {
                fontSize: '14px',
                fontWeight: '400',
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            style: {
                fontSize: '14px'
            }
        },
        series: [
            {
                name: 'Precision < 24 h',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: new Highcharts.Color(COLORS.PRECISION_NEW.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderColor: precBorderColor,
                borderWidth: 1,
                stack: "precision",
                tooltip: {
                    pointFormat: `<span style="${precTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 0,
            },
            {
                name: 'Precision ≤ 48 h',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: new Highcharts.Color(COLORS.PRECISION_MEDIUM.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderColor: precBorderColor,
                borderWidth: 1,
                stack: "precision",
                tooltip: {
                    pointFormat: `<span style="${precTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 1,
            },
            {
                name: 'Precision > 48 h',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: new Highcharts.Color(COLORS.PRECISION_OLD.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderColor: precBorderColor,
                borderWidth: 1,
                stack: "precision",
                tooltip: {
                    pointFormat: `<span style="${precTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 3,
            },
            {
                name: 'Size ≥ 500.000 m²',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: COLORS.SIZE_MAX,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                stack: "size",
                tooltip: {
                    pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 7,
            },
            {
                name: 'Size < 500.000 m²',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: COLORS.SIZE_500_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                stack: "size",
                tooltip: {
                    pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 6,
            },
            {
                name: 'Size < 100.000 m²',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: COLORS.SIZE_100_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                stack: "size",
                tooltip: {
                    pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 5,
            },
            {
                name: 'Size < 50.000 m²',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: COLORS.SIZE_50_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                stack: "size",
                tooltip: {
                    pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 4,
            },
            {
                name: 'Size < 10.000 m²',
                data: emptyArray_(dates.length, 0),
                type: "column",
                color: COLORS.SIZE_10_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                stack: "size",
                tooltip: {
                    pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`
                },
                legendIndex: 3,
            },
        ]
    }, () => null);
    let size = Highcharts.chart('charts-size', {
        chart: {
            type: 'column',
            backgroundColor: COLORS.BACKGROUND,
            style: {
                fontFamily: 'Source Sans Pro, sans-serif',
            }
        },
        plotOptions: {
            column: {
                stacking: 'normal',
            }
        },
        title: {
            text: D_SIZE,
            style: {
                fontSize: '24px',
            }
        },
        xAxis: {
            categories: SIZE_CATEGORIES,
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        yAxis: {
            allowDecimals: false,
            title: {
                text: 'Detected avalanches',
                style: {
                    fontSize: '20px',
                    fontWeight: '600',
                }
            },
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`,
            style: {
                fontSize: '14px'
            }
        },
        series: [
            {
                name: 'Size < 10.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_10_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 50.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_50_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 100.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_100_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 500.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_500_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size ≥ 500.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_MAX,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
            },
        ]
    }, () => null);
    let height = Highcharts.chart('charts-height', {
        chart: {
            type: 'bar',
            backgroundColor: COLORS.BACKGROUND,
            style: {
                fontFamily: 'Source Sans Pro, sans-serif',
            }
        },
        title: {
            text: D_HEIGHT,
            style: {
                fontSize: '24px',
            }
        },
        plotOptions: {
            bar: {
                pointPadding: 0.1,
                groupPadding: 0.1,
                stacking: 'normal',
            },
        },
        xAxis: {
            categories: [],
            reversed: false,
            labels: {
                style: {
                    fontSize: '14px',
                },
            }
        },
        yAxis: {
            allowDecimals: false,
            title: {
                text: 'Detected avalanches',
                style: {
                    fontSize: '20px',
                    fontWeight: '600',
                }
            },
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`,
            style: {
                fontSize: '14px'
            }
        },
        series: [
            {
                name: 'Size ≥ 500.000 m²',
                data: [],
                type: "bar",
                color: COLORS.SIZE_MAX,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
                pointPlacement: 'between',
            },
            {
                name: 'Size < 500.000 m²',
                data: [],
                type: "bar",
                color: COLORS.SIZE_500_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
                pointPlacement: 'between',
            },
            {
                name: 'Size < 100.000 m²',
                data: [],
                type: "bar",
                color: COLORS.SIZE_100_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
                pointPlacement: 'between',
            },
            {
                name: 'Size < 50.000 m²',
                data: [],
                type: "bar",
                color: COLORS.SIZE_50_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
                pointPlacement: 'between',
            },
            {
                name: 'Size < 10.000 m²',
                data: [],
                type: "bar",
                color: COLORS.SIZE_10_000,
                borderColor: sizeBorderColor,
                borderWidth: 1,
                showInLegend: false,
                pointPlacement: 'between',
            },
        ]
    }, () => null);
    let exposition = Highcharts.chart('charts-exposition', {
        chart: {
            polar: true,
            backgroundColor: COLORS.BACKGROUND,
            style: {
                fontFamily: 'Source Sans Pro, sans-serif',
            }
        },
        title: {
            text: EXPOSITION,
            style: {
                fontSize: '24px',
            }
        },
        xAxis: {
            categories: EXPOSITIONS,
            tickmarkPlacement: 'on',
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        yAxis: {
            min: 0,
            max: 1,
            labels: {
                style: {
                    fontSize: '14px',
                }
            }
        },
        plotOptions: {
            column: {
                pointPadding: 0,
                groupPadding: 0,
                stacking: 'normal',
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            pointFormat: `<span style="${sizeTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`,
            style: {
                fontSize: '14px'
            }
        },
        series: [
            {
                name: 'Size ≥ 500.000 m²',
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.SIZE_MAX,
                pointPlacement: 'on',
                showInLegend: false,
                borderColor: sizeBorderColor,
                borderWidth: 1,
            },
            {
                name: 'Size < 500.000 m²',
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.SIZE_500_000,
                pointPlacement: 'on',
                showInLegend: false,
                borderColor: sizeBorderColor,
                borderWidth: 1,
            },
            {
                name: 'Size < 100.000 m²',
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.SIZE_100_000,
                pointPlacement: 'on',
                showInLegend: false,
                borderColor: sizeBorderColor,
                borderWidth: 1,
            },
            {
                name: 'Size < 50.000 m²',
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.SIZE_50_000,
                pointPlacement: 'on',
                showInLegend: false,
                borderColor: sizeBorderColor,
                borderWidth: 1,
            },
            {
                name: 'Size < 10.000 m²',
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.SIZE_10_000,
                pointPlacement: 'on',
                showInLegend: false,
                borderColor: sizeBorderColor,
                borderWidth: 1,
            },
        ],
    }, () => null);

    return {
        timeline,
        size,
        height,
        exposition,
    };
}

/**
 * Add features to the size part of the timeline. Make sure to add features not already present in the chart.
 * @param features: Feature[] - Features to add to the timeline statistics.
 * @param charts: Charts
 * @param controls: Controls
 */
function calculateTimelineEvent(features: Feature[], charts: Charts, controls: Controls) {
    features.forEach((feature) => {
        let date = db2Date(feature.get('skredTidspunkt'));
        date.setHours(0, 0, 0, 0);
        let dateStart = new Date(controls.dateStart.value);
        let offset = Math.round((date.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));
        let series = charts.timeline.series[7 - getSizeOffset_(feature, controls)];
        let dataPoint = series.data[offset].y;
        series.data[offset].update({y: dataPoint + 1}, false);
    });
    charts.timeline.redraw();
}

/**
 * Add features to the precision part of the timeline. Make sure to add features not already present in the chart.
 * @param features: Feature[] - Features to add to the timeline statistics.
 * @param charts: Charts
 * @param controls: Controls
 */
function calculateTimelineCluster(features: Feature[], charts: Charts, controls: Controls) {
    features.forEach((feature) => {
        let date = db2Date(feature.get('skredTidspunkt'));
        date.setHours(0, 0, 0, 0);
        let dateStart = new Date(controls.dateStart.value);
        let offset = Math.round((date.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));
        let precision = getPrecision(feature);
        let series;
        if (precision < 24) {
            series = charts.timeline.series[0];
        } else if (precision <= 48) {
            series = charts.timeline.series[1];
        } else {
            series = charts.timeline.series[2];
        }
        let dataPoint = series.data[offset].y;
        series.data[offset].update({y: dataPoint + 1}, false);
    });

    charts.timeline.setTitle({text: A_TIME});
    charts.timeline.redraw();
}

/**
 * Add features to the size chart. Make sure to add features not already present in the chart.
 * @param features: Feature[] - Features to add to the size chart.
 * @param charts: Charts
 * @param controls: Controls
 */
function calculateSize(features: Feature[], charts: Charts, controls: Controls) {
    features.forEach((feature) => {
        let offset = getSizeOffset_(feature, controls);
        let series = charts.size.series[offset];
        let dataPoint = series.data[offset].y;
        series.data[offset].update({y: dataPoint + 1}, false);
    });

    charts.size.redraw();
}

/**
 * Add features to the height chart. Make sure to add features not already present in the chart.
 * @param features: Feature[] - Features to add to the height chart.
 * @param charts: Charts
 * @param controls: Controls
 */
function calculateHeight(features: Feature[], charts: Charts, controls: Controls) {
    features.forEach((feature) => {
        let offset = charts.height.series.length - 1 - getSizeOffset_(feature, controls);
        let series = charts.height.series[offset];

        let height = feature.get('hoydeStoppSkred_moh');
        let idx = Math.floor(height / 200);
        while (series.xAxis.categories.length < idx + 1) {
            let categories = series.xAxis.categories;
            let newCategory = `${categories.length * 200} m.a.s.l.`;
            series.xAxis.setCategories(categories.concat([newCategory]));
        }
        while (series.data.length < idx + 1) {
            series.setData(series.data.map(p => p.y).concat([0]));
        }
        let dataPoint = series.data[idx].y;
        series.data[idx].update({y: dataPoint + 1}, false);
    });

    charts.height.redraw();
}

/**
 * Add features to the exposition chart. Make sure to add features not already present in the chart.
 * @param features: Feature[] - Features to add to the exposition chart.
 * @param charts: Charts
 * @param controls: Controls
 */
function calculateExposition(features: Feature[], charts: Charts, controls: Controls) {
    features.forEach((feature) => {
        let offset = charts.exposition.series.length - 1 - getSizeOffset_(feature, controls);
        let series = charts.exposition.series[offset];

        let aspect = parseInt(feature.get("eksposisjonUtlopsomr"), 10);
        if (!isNaN(aspect)) {
            let idx = (Math.floor((aspect + 22.5) / (360 / 8)) % 8 + 8) % 8;
            let dataPoint = series.data[idx].y;
            series.data[idx].update({y: dataPoint + 1}, false);
        }
    });

    // Find the height of the tallest column in the compass (to set scale after).
    let max = Math.max(...charts.exposition.series.map((series) =>
        series.data.map((p) => p.y)
    ).reduce((seriesA, seriesB) => {
        let sum = [];
        for (let i = 0; i < seriesA.length; i++) {
            sum.push(seriesA[i] + seriesB[i]);
        }
        return sum
    }, emptyArray_(charts.exposition.series[0].data.length, 0)));

    charts.exposition.yAxis[0].setExtremes(0, max + 1);
}

/**
 * Remove all statistics from all charts. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the charts.
 * @param charts: Charts
 * @param controls: Controls
 */
function clearStatistics(redraw: boolean, charts: Charts, controls: Controls) {
    clearTimeline(true, true, redraw, charts, controls);
    clearSize(redraw, charts, controls);
    clearHeight(redraw, charts, controls);
    clearExposition(redraw, charts, controls);
}

/**
 * Only remove the data from the timeline that is outside the selected daterange. Keep everything else, but shift it.
 * @param charts: CHarts
 * @param controls: Controls
 * @param ol: OlObjects
 */
function updateTimelineDates(charts: Charts, controls: Controls, ol: OlObjects) {
    let dateStart = new Date(controls.dateStart.value as string);
    let dateEnd = new Date(controls.dateEnd.value as string);
    let oldDateStart = new Date(charts.timeline.xAxis[0].categories[0]);

    charts.timeline.series.forEach((series: Highcharts.Series) => {
        let size = Math.round((dateEnd.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));
        let newData = emptyArray_(size, 0);

        for (let dateString of Object.keys(ol.clustersByDate))  {
            let storedDate = new Date(dateString);
            if (dateStart <= storedDate && storedDate < dateEnd && oldDateStart <= storedDate) {
                let oldOffset = Math.round((storedDate.getTime() - oldDateStart.getTime()) / (1000 * 3600 * 24));
                let newOffset = Math.round((storedDate.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));
                if (newOffset < size) {
                    newData[newOffset] = series.data[oldOffset].y;
                }
            }
        }
        series.setData(newData, false);
    });

    let range = dateRange(new Date(controls.dateStart.value), new Date(controls.dateEnd.value));
    charts.timeline.xAxis[0].setCategories(range, true);
}

/**
 * Remove all statistics from the timeline.
 * @param precision: bookean - Whether to clear precision series
 * @param size: bookean - Whether to clear size series
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearTimeline(precision: boolean, size: boolean, redraw: boolean, charts: Charts, controls: Controls) {
    let categories = getCategories_(controls);
    if (precision) {
        for (let idx of [0, 1, 2]) {
            let series = charts.timeline.series[idx];
            series.setData(emptyArray_(series.data.length, 0), false);
        }
    }
    if (size) {
        for (let idx of [3, 4, 5, 6, 7]) {
            let series = charts.timeline.series[idx];
            series.setData(emptyArray_(series.data.length, 0), false);
            series.update({type: "column", name: categories[7 - idx]}, false);
        }
    }
    if (redraw) charts.timeline.redraw();
}

/**
 * Remove all statistics from the size chart. I.e., set all y-values to 0.
 * If x-axis setting for labels have change, change labels.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 * @param controls: Controls
 */
function clearSize(redraw: boolean, charts: Charts, controls: Controls) {
    let categories = getCategories_(controls);
    charts.size.series.forEach((series,idx) => {
        series.setData(emptyArray_(categories.length, 0), false);
        series.update({type: "column", name: categories[idx]}, false);
    });
    charts.size.xAxis[0].setCategories(categories, redraw);
}

/**
 * Remove all statistics from the height chart. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearHeight(redraw: boolean, charts: Charts, controls: Controls) {
    let categories = getCategories_(controls).reverse();
    charts.height.series.forEach((series, idx) => {
        series.update({type: "bar", name: categories[idx]}, false);
        series.setData([], false);
        series.xAxis.setCategories([], false);
    });
    charts.height.redraw()
}

/**
 * Remove all statistics from the exposition chart. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearExposition(redraw: boolean, charts: Charts, controls: Controls) {
    let categories = getCategories_(controls).reverse();
    charts.exposition.series.forEach((series, idx) => {
        series.update({type: "column", name: categories[idx]}, false);
        series.setData(emptyArray_(8, 0), false);
    });
    charts.exposition.yAxis[0].setExtremes(0, 1, redraw);
}

function emptyArray_(size: number, value: number): Array<number> {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}

function getSizeOffset_(feature: Feature, controls: Controls): number {
    if (controls.areaDsizeRadio[0].checked) {
        let area = feature.get("area");
        if (area < 10_000) {
            return 0;
        } else if (area < 50_000) {
            return 1;
        } else if (area < 100_000) {
            return 2;
        } else if (area < 500_000) {
            return 3;
        } else {
            return 4;
        }
    } else {
        let area = feature.get("area");
        let volume = area * parseInt(controls.dsizeDepth.value, 10) / 100;
        let offset;
        if (volume < Math.pow(10, 2.5)) {
            return 0;
        } else if (volume < Math.pow(10, 3.5)) {
            return 1;
        } else if (volume < Math.pow(10, 4.5)) {
            return 2;
        } else if (volume < Math.pow(10, 5.5)) {
            return 3;
        } else {
            return 4;
        }
    }
}

function getCategories_(controls: Controls) {
    if (controls.areaDsizeRadio[0].checked) {
        return SIZE_CATEGORIES.slice();
    } else {
        return DSIZE_CATEGORIES.slice();
    }
}

export {
    EXPOSITIONS,
    Charts,
    initCharts,
    calculateTimelineEvent,
    calculateTimelineCluster,
    calculateSize,
    calculateHeight,
    calculateExposition,
    clearStatistics,
    updateTimelineDates,
    clearTimeline,
    clearSize,
    clearHeight,
    clearExposition,
};
