import * as Highcharts from 'highcharts';
import * as HighchartsMore from "highcharts/highcharts-more";
import {Controls} from "./controls";
import {dateRange} from "./date";
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
const EXPOSITIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const EXPOSITIONS_NO = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];
const D_SIZE = "Debris area";
const D_HEIGHT = "Debris elevation";
const A_TIME = "Avalanche Timeline";
const EXPOSITION = "Debris Exposition";

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
                }
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
                }
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
                }
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
                }
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
                }
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
                }
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
                }
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
                }
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
                borderColor: new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 50.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_50_000,
                borderColor: new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 100.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_100_000,
                borderColor: new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size < 500.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_500_000,
                borderColor: new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get(),
                borderWidth: 1,
                showInLegend: false,
            },
            {
                name: 'Size ≥ 500.000 m²',
                data: emptyArray_(SIZE_CATEGORIES.length, 0),
                type: "column",
                color: COLORS.SIZE_MAX,
                borderColor: new Highcharts.Color(COLORS.BORDER_SIZE.toString()).setOpacity(VECTOR_OPACITY).get(),
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
                groupPadding: 0.1
            }
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
                name: 'Detected avalanches',
                data: [],
                type: "bar",
                color: COLORS.HEIGHT,
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
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size: 12px">{point.key}</span><br/>',
            pointFormat: `<span style="${basicTooltipStyle}">●</span> {series.name}: <b>{point.y}</b><br/>`,
            style: {
                fontSize: '14px'
            }
        },
        series: [
            {
                name: "Exposition",
                data: emptyArray_(EXPOSITIONS.length, 0),
                type: "column",
                color: COLORS.EXPOSITION,
                pointPlacement: 'on',
                showInLegend: false,
            },
        ]
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
        let date = new Date(feature.get('skredTidspunkt'));
        date.setHours(0, 0, 0, 0);
        let dateStart = new Date(controls.dateStart.value);
        let offset = Math.round((date.getTime() - dateStart.getTime()) / (1000 * 3600 * 24));
        let area = feature.get("area");
        let series;
        if (area < 10_000) {
            series = charts.timeline.series[7];
        } else if (area < 50_000) {
            series = charts.timeline.series[6];
        } else if (area < 100_000) {
            series = charts.timeline.series[5];
        } else if (area < 500_000) {
            series = charts.timeline.series[4];
        } else {
            series = charts.timeline.series[3];
        }
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
        let date = new Date(feature.get('skredTidspunkt'));
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
        let area = feature.get("area");
        let offset;
        if (area < 10_000) {
            offset = 0;
        } else if (area < 50_000) {
            offset = 1;
        } else if (area < 100_000) {
            offset = 2;
        } else if (area < 500_000) {
            offset = 3;
        } else {
            offset = 4;
        }
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
        let height = feature.get('hoydeStoppSkred_moh');
        let series = charts.height.series[0];
        let offset = Math.floor(height / 200);
        while (series.xAxis.categories.length < offset + 1) {
            let categories = series.xAxis.categories;
            let newCategory = `${categories.length * 200} m.a.s.l.`;
            series.xAxis.setCategories(categories.concat([newCategory]));
            series.setData(series.data.map(p => p.y).concat([0]));
        }
        let dataPoint = series.data[offset].y;
        series.data[offset].update({y: dataPoint + 1}, false);
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
    let series = charts.exposition.series[0];
    features.forEach((feature) => {
        let aspect = feature.get("eksposisjonUtlosningsomr");
        let idx = EXPOSITIONS_NO.indexOf(aspect);
        if (idx != -1) {
            let dataPoint = series.data[idx].y;
            series.data[idx].update({y: dataPoint + 1}, false);
        }
    });

    let max = Math.max(...series.data.map((p) => p.y));
    charts.exposition.yAxis[0].setExtremes(0, max + 1);
}

/**
 * Remove all statistics from all charts. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the charts.
 * @param charts: Charts
 */
function clearStatistics(redraw: boolean, charts: Charts) {
    charts.timeline.series.forEach((series) => {
        series.setData(emptyArray_(series.data.length, 0), redraw);
    });
    clearSize(redraw, charts);
    clearHeight(redraw, charts);
    clearExposition(redraw, charts);
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
 * Remove all statistics from the size chart. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearSize(redraw: boolean, charts: Charts) {
    charts.size.series.forEach((series) => {
        series.setData(emptyArray_(SIZE_CATEGORIES.length, 0), redraw);
    })
}

/**
 * Remove all statistics from the height chart. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearHeight(redraw: boolean, charts: Charts) {
    let series = charts.height.series[0];
    series.setData([], false);
    series.xAxis.setCategories([], redraw);
}

/**
 * Remove all statistics from the exposition chart. I.e., set all y-values to 0.
 * @param redraw: boolean - Whether to redraw the chart.
 * @param charts: Charts
 */
function clearExposition(redraw: boolean, charts: Charts) {
    charts.exposition.series.forEach((series) => {
        series.setData(emptyArray_(EXPOSITIONS.length, 0), redraw);
    });
    charts.exposition.yAxis[0].setExtremes(0, 1);
}

function emptyArray_(size: number, value: number): Array<number> {
    return Array.apply(null, new Array(size)).map(Number.prototype.valueOf, value);
}

export {
    EXPOSITIONS,
    EXPOSITIONS_NO,
    Charts,
    initCharts,
    calculateTimelineEvent,
    calculateTimelineCluster,
    calculateSize,
    calculateHeight,
    calculateExposition,
    clearStatistics,
    updateTimelineDates,
    clearSize,
    clearHeight,
    clearExposition,
};