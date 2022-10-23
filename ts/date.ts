const DATE_FORMAT: Record<string, "numeric"|"2-digit"> = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

const TIME_FORMAT: Record<string, "numeric"|"2-digit"|boolean> = {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
};

/**
 * Creates a Date from datestring from database.
 * @param date: yyyy-mm-dd hh-MM-ss.xxxxxx
 * @return Date
 */
function db2Date(dateString: string): Date {
    // Safari is picky about date parsing
    let year = parseInt(dateString.slice(0, 4), 10);
    let month = parseInt(dateString.slice(5, 7), 10) - 1;
    let day = parseInt(dateString.slice(8, 10), 10);
    let [hour, minute, second] = [0, 0, 0];
    if (dateString.length > 10) {
        hour = parseInt(dateString.slice(11, 13), 10);
        minute = parseInt(dateString.slice(14, 16), 10);
        second = parseInt(dateString.slice(17, 19), 10);
    }
    return new Date(year, month, day, hour, minute, second)
}

/**
 * Transforms Date to datestring of format yyyy-mm-dd
 * @param date: Date
 * @return string - yyyy-mm-dd
 */
function getDate(date: Date): string {
    return date.toLocaleString('sv-SE', DATE_FORMAT);
}

/**
 * Generates an array of datestrings given the start and end.
 * @param start: Date - The start of the range, inclusive.
 * @param end: Date - The end of the range, exclusive.
 * @return string[]
 */
function dateRange(start: Date, end: Date): string[] {
    let range = [start];
    let tail: (range: Date[]) => Date = (range) => range.slice(-1)[0];
    while (tail(range).getTime() < end.getTime() - 1000 * 3600 * 24) {
        range.push(new Date(tail(range).getTime() + 1000 * 3600 * 24));
    }
    return range.map((date) => getDate(date));
}

export {DATE_FORMAT, TIME_FORMAT, dateRange, getDate, db2Date};