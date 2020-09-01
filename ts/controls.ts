import * as Cookie from "./cookie";
import {getDate} from "./date";
import {COLORS, VECTOR_OPACITY} from "./color";
import {OlObjects} from "./ol";

interface Controls {
    dateStart: HTMLInputElement,
    dateEnd: HTMLInputElement,
    regionSelector: HTMLSelectElement,
    areaDsizeRadio: [HTMLInputElement, HTMLInputElement],
    dsizeDepth: HTMLInputElement,
}

/**
 * Initialize the controls. Set to values appropriate given cookies and GET parameters.
 * @return Controls
 */
function initControls(): Controls {
    let storedDateStart = Cookie.getCookie("dateStart");
    let storedDateEnd = Cookie.getCookie("dateEnd");
    let storedSize = Cookie.getCookie("size");
    let storedSizeDepth = Cookie.getCookie("sizeDepth");
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

    let areaRadio = document.getElementById("radio-area") as HTMLInputElement;
    let dsizeRadio = document.getElementById("radio-dsize") as HTMLInputElement;
    let dsizeDepth = document.getElementById("dsize-depth") as HTMLInputElement;
    if (storedSize == "dsize") dsizeRadio.checked = true;
    if (storedSizeDepth) dsizeDepth.value = storedSizeDepth;

    return {
        dateStart,
        dateEnd,
        regionSelector,
        areaDsizeRadio: [areaRadio, dsizeRadio],
        dsizeDepth
    };
}

/**
 * Update controls after daterange start as changed.
 * @param oldDateStart: Date - Previous value of controls.dateStart
 * @param oldDateEnd: Date - Previous value of controls.dateEnd
 * @param controls: Controls
 * @return [Date, Date]
 */
function adjustRangeStart(oldDateStart: Date, oldDateEnd: Date, controls: Controls): [Date, Date] {
    let dateStartValue = new Date(controls.dateStart.value);
    let endDay = new Date(dateStartValue.getTime() + oldDateEnd.getTime() - oldDateStart.getTime());
    let newMin = new Date(dateStartValue.getTime() + 1000 * 3600 * 24);
    controls.dateEnd.value = getDate(endDay);
    controls.dateEnd.min = getDate(newMin);
    Cookie.setCookie("dateStart", getDate(dateStartValue), Cookie.TTL);
    Cookie.setCookie("dateEnd", getDate(endDay), Cookie.TTL);
    return [dateStartValue, new Date(getDate(endDay))];
}

/**
 * Update controls after daterange end as changed.
 * @param oldDateStart: Date - Previous value of controls.dateStart
 * @param controls: Controls
 * @return [Date, Date]
 */
function adjustRangeEnd(oldDateStart: Date, controls: Controls): [Date, Date] {
    let dateEndValue = new Date(controls.dateEnd.value);
    Cookie.setCookie("dateEnd", getDate(dateEndValue), Cookie.TTL);
    return [oldDateStart, new Date(controls.dateEnd.value as string)];
}

/**
 * Add a region to the region selector, and see if there is reason (cookie or GET parameter) to select that region.
 * @param id: number - Numerical ID of the region
 * @param name: string - Region name
 * @param controls: Controls
 * @param ol: OlObjects
 */
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

/**
 * Update controls after a new region has been selected.
 * @param ol: OlObjects
 * @param controls: Controls
 */
function adjustRegion(ol: OlObjects, controls: Controls): void {
    let option = controls.regionSelector.options[controls.regionSelector.selectedIndex];
    let name = option ? option.innerText : "";
    Cookie.setCookie("region", name, Cookie.TTL);
}


/**
 * Update controls after sie type has been updated.
 * @param controls: Controls
 */
function adjustSize(controls: Controls): void {
    let size = "area";
    if (controls.areaDsizeRadio[1].checked) {
        size = "dsize";
        Cookie.setCookie("sizeDepth", controls.dsizeDepth.value, Cookie.TTL);
    }
    Cookie.setCookie("size", size, Cookie.TTL);
}

/**
 * Controls visibility of a warning stating that no results were found.
 * @param state: Whether to show warning of no results or not.
 */
function showEmptyBox(state: boolean): void {
    let emptyBox = document.getElementById('emptybox') as HTMLDivElement;
    emptyBox.style.display = state ? 'block' : 'none';
}

export {
    Controls,
    initControls,
    adjustRangeStart,
    adjustRangeEnd,
    addRegion,
    adjustRegion,
    adjustSize,
    showEmptyBox
};