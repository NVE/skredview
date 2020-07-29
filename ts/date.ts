const DATE_FORMAT = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
};

const TIME_FORMAT = {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
};

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

export {DATE_FORMAT, TIME_FORMAT, dateRange, getDate};