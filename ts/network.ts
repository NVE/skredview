/**
 * Runs a GET XHR, returning the respons text to a callback.
 * @param url: string
 * @param old_request: [XMLHttpRequest] - Old request of same type to invalidate. Encapsuled to enable mutation.
 * @param callback: (responseText: string) => void
 */
function get(url: string, old_request: [XMLHttpRequest | null], callback: (responseText: string) => void): void {
    if (old_request[0]) old_request[0].abort();
    let request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.onreadystatechange = () => {
        if (request.readyState == XMLHttpRequest.DONE) {
            if (request.status >= 200 && request.status < 400) {
                callback(request.responseText);
            }
        }
    };
    request.send();
    old_request[0] = request;
}

export {get};