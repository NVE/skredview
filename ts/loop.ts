function yieldingForEach<T>(
    elems: Array<T>,
    chunksize: number,
    callback: (elem: T) => void,
    finished: () => void
) {
    let i: number = 0;
    (function chunk() {
        var end = Math.min(i + chunksize, elems.length);
        for ( ; i < end; ++i) {
            callback.call(null, elems[i]);
        }
        if (i < elems.length) {
            setTimeout(chunk, 0);
        } else {
            finished.call(null);
        }
    })();
}

export {yieldingForEach}