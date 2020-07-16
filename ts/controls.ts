import * as Cookie from "./cookie";
import {OlObjects, COLORS} from "./ol";

interface Controls {
    dateStart: HTMLInputElement,
    dateEnd: HTMLInputElement,
    regionSelector: HTMLSelectElement,
}

function initControls(): Controls {
    let storedDateStart = Cookie.getCookie("dateStart");
    let storedDateEnd = Cookie.getCookie("dateEnd");
    let dateStart = document.getElementById('date-start') as HTMLInputElement;
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let today = new Date();
    let nextDay = new Date(today.getTime() + 1000 * 3600 * 24);
    dateStart.value = storedDateStart ? storedDateStart : getDate_(today);
    dateEnd.value = storedDateEnd ? storedDateEnd : getDate_(nextDay);
    let newMin = new Date(new Date(dateStart.value).getTime() + 1000 * 3600 * 24);
    dateStart.max = getDate_(nextDay);
    dateEnd.min = getDate_(newMin);

    let newCircle = document.getElementById('new-circle') as Element as SVGCircleElement;
    let mediumCircle = document.getElementById('medium-circle') as Element as SVGCircleElement;
    let oldCircle = document.getElementById('old-circle') as Element as SVGCircleElement;
    newCircle.style.fill = COLORS.NEW;
    mediumCircle.style.fill = COLORS.MEDIUM;
    oldCircle.style.fill = COLORS.OLD;

    let regionSelector = document.getElementById("region-selector") as HTMLSelectElement;

    return {dateStart, dateEnd, regionSelector};
}

function adjustRangeStart(currentDateStart: Date, currentDateEnd: Date): [Date, Date] {
    let dateStart = document.getElementById('date-start') as HTMLInputElement;
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let dateStartValue = new Date(dateStart.value);
    let dateEndValue = new Date(dateEnd.value);
    let endDay = new Date(dateStartValue.getTime() + currentDateEnd.getTime() - currentDateStart.getTime());
    let newMin = new Date(dateStartValue.getTime() + 1000 * 3600 * 24);
    dateEnd.value = getDate_(endDay);
    dateEnd.min = getDate_(newMin);
    Cookie.setCookie("dateStart", getDate_(dateStartValue), Cookie.TTL);
    Cookie.setCookie("dateEnd", getDate_(dateEndValue), Cookie.TTL);
    return [dateStartValue, new Date(getDate_(endDay))];
}

function adjustRangeEnd(currentDateStart: Date): [Date, Date] {
    let dateEnd = document.getElementById('date-end') as HTMLInputElement;
    let dateEndValue = new Date(dateEnd.value);
    Cookie.setCookie("dateEnd", getDate_(dateEndValue), Cookie.TTL);
    return [currentDateStart, new Date(dateEnd.value as string)];
}

function addRegion( name: string, controls: Controls): void {

    let option = document.createElement("option");
    option.value = name;
    option.innerText = name;
    controls.regionSelector.appendChild(option);

    let storedRegion = Cookie.getCookie("region");
    if (storedRegion == name) {
        controls.regionSelector.value = storedRegion;
        controls.regionSelector.dispatchEvent(new Event("input"));
    }
}

function adjustRegion(ol: OlObjects, controls: Controls): void {
    let name = controls.regionSelector.value;
    Cookie.setCookie("region", name, Cookie.TTL);
}

function getDate_(date: Date): string {
    return date.toISOString().substring(0, 10);
}

export {Controls, initControls, adjustRangeStart, adjustRangeEnd, addRegion, adjustRegion};