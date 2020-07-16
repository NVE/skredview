const TTL = 1000 * 3600 * 24 * 30;

function getCookie(cname: string): string {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname: string, value: string, ttl: number): void {
    let expiry = new Date(Date.now() + ttl).toUTCString();
    document.cookie = cname + '=' + value + '; expires=' + expiry + ';';
}

export {TTL, getCookie, setCookie};