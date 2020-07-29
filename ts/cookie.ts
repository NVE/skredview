const TTL = 1000 * 3600 * 24 * 30;

/**
 * Fetch existing cookie
 * @param cname: string - Cookie name
 * @return string - Cookie value
 */
function getCookie(cname: string): string {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

/**
 * Set cookie
 * @param cname: string - Cookie name
 * @param value: string
 * @param ttl: number - Time to live in ms
 */
function setCookie(cname: string, value: string, ttl: number): void {
    let expiry = new Date(Date.now() + ttl).toUTCString();
    document.cookie = cname + '=' + value + '; expires=' + expiry + ';';
}

export {TTL, getCookie, setCookie};