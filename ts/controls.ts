import * as Cookie from "./cookie";
import {getDate} from "./date";
import {COLORS, VECTOR_OPACITY} from "./color";
import {OlObjects} from "./ol";

interface Controls {
    dateStart: HTMLInputElement,
    dateEnd: HTMLInputElement,
    regionSelector: HTMLSelectElement,
}

function initControls(): Controls {
    let storedDateStart = Cookie.getCookie("dateStart");
    let storedDateEnd = Cookie.getCookie("dateEnd");
    let urlDateFrom = new Date(new URL(window.location.href).searchParams.get("dateFrom"));
    let urlDateTo = new Date(new URL(window.location.href).searchParams.get("dateTo"));
    let dateStart = document.getElementById('date-start') as HTMLInputElement;
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let today = new Date();
    let nextDay = new Date(today.getTime() + 1000 * 3600 * 24);
    if (!isNaN(urlDateFrom.getTime()) && !isNaN(urlDateTo.getTime()) && urlDateFrom < urlDateTo) {
        dateStart.value = getDate(urlDateFrom);
        dateEnd.value = getDate(urlDateTo);
        Cookie.setCookie("dateStart", dateStart.value, Cookie.TTL);
        Cookie.setCookie("dateEnd", dateEnd.value, Cookie.TTL);
    } else {
        dateStart.value = storedDateStart ? storedDateStart : getDate(today);
        dateEnd.value = storedDateEnd ? storedDateEnd : getDate(nextDay);
    }
    let newMin = new Date(new Date(dateStart.value).getTime() + 1000 * 3600 * 24);
    dateStart.max = getDate(today);
    dateEnd.max = getDate(nextDay);
    dateEnd.min = getDate(newMin);

    let newCircle = document.getElementById('new-circle') as Element as SVGCircleElement;
    let mediumCircle = document.getElementById('medium-circle') as Element as SVGCircleElement;
    let oldCircle = document.getElementById('old-circle') as Element as SVGCircleElement;
    newCircle.style.fill = COLORS.PRECISION_NEW;
    mediumCircle.style.fill = COLORS.PRECISION_MEDIUM;
    oldCircle.style.fill = COLORS.PRECISION_OLD;
    newCircle.style.stroke = COLORS.BORDER_EVENT;
    mediumCircle.style.stroke = COLORS.BORDER_EVENT;
    oldCircle.style.stroke = COLORS.BORDER_EVENT;
    newCircle.style.opacity = VECTOR_OPACITY.toString();
    mediumCircle.style.opacity = VECTOR_OPACITY.toString();
    oldCircle.style.opacity = VECTOR_OPACITY.toString();

    let regionSelector = document.getElementById("region-selector") as HTMLSelectElement;

    return {dateStart, dateEnd, regionSelector};
}

function adjustRangeStart(oldDateStart: Date, oldDateEnd: Date): [Date, Date] {
    let dateStart = document.getElementById('date-start') as HTMLInputElement;
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let dateStartValue = new Date(dateStart.value);
    let endDay = new Date(dateStartValue.getTime() + oldDateEnd.getTime() - oldDateStart.getTime());
    let newMin = new Date(dateStartValue.getTime() + 1000 * 3600 * 24);
    dateEnd.value = getDate(endDay);
    dateEnd.min = getDate(newMin);
    Cookie.setCookie("dateStart", getDate(dateStartValue), Cookie.TTL);
    Cookie.setCookie("dateEnd", getDate(endDay), Cookie.TTL);
    return [dateStartValue, new Date(getDate(endDay))];
}

function adjustRangeEnd(oldDateStart: Date): [Date, Date] {
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let dateEndValue = new Date(dateEnd.value);
    Cookie.setCookie("dateEnd", getDate(dateEndValue), Cookie.TTL);
    return [oldDateStart, new Date(dateEnd.value as string)];
}

function addRegion(id: number, name: string, controls: Controls, ol: OlObjects): void {
    let option = document.createElement("option");
    let idString = id.toString();
    option.value = idString;
    option.innerText = name;
    controls.regionSelector.appendChild(option);

    let storedRegion = Cookie.getCookie("region");
    let urlRegion = new URL(window.location.href).searchParams.get("regionId");
    if (urlRegion == idString) {
        ol.map.getView().fit(ol.regions[id].getGeometry().getExtent());
        controls.regionSelector.value = urlRegion;
        controls.regionSelector.dispatchEvent(new Event("input"));
    } else if (storedRegion == name) {
        controls.regionSelector.value = idString;
        controls.regionSelector.dispatchEvent(new Event("input"));
    }
}

function adjustRegion(ol: OlObjects, controls: Controls): void {
    let option = controls.regionSelector.options[controls.regionSelector.selectedIndex];
    let name = option ? option.innerText : "";
    Cookie.setCookie("region", name, Cookie.TTL);
}

export {Controls, initControls, adjustRangeStart, adjustRangeEnd, addRegion, adjustRegion, getDate};