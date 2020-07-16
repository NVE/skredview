from flask import Flask, request
import geopandas as gpd
import pyodbc
import datetime as dt
import multiprocessing
import contextlib

EPSG = 32633

def pool(connection_string):
    intital = 5
    cursors = []
    local_pool = multiprocessing.Queue()
    for _ in range(0, intital):
        cursors.append(pyodbc.connect(connection_string))
    n = multiprocessing.Value('i', intital - 1)
    @contextlib.contextmanager
    def pooled():
        try:
            idx = local_pool.get(False)
        except multiprocessing.queues.Empty:
            with n.get_lock():
                n.value += 1
                idx = n.value
                cursors.append(pyodbc.connect(connection_string))
        yield cursors[idx]
        local_pool.put(idx)
    return pooled

app = Flask(__name__, static_folder='../static', static_url_path='/static')
sql = pool('Driver={Driver};'
           'Server=db.example.com;'
           'Database=acme;'
           'Trusted_Connection=yes;')

@app.route('/')
def root():
    return app.send_static_file('html/index.html')

@app.route('/api/events/polygons/')
def events():
    q = f"""
        SELECT
            h.[skredType],
            h.[skredTidspunkt],
            h.[noySkredTidspunkt],
            h.[registrertDato],
            h.[registrertAv],
            h.[regStatus],
            t.[skredAreal_m2],
            t.[eksposisjonUtlopsomr],
            t.[snittHelningUtlopssomr_gr],
            t.[maksHelningUtlopsomr_gr],
            t.[minHelningUtlopsomr_gr],
            t.[hoydeStoppSkred_moh],
            t.[noyHoydeStoppSkred],
            h.[skredID],
            u.[SHAPE].STAsBinary() AS geom
        FROM [skredprod].[skred].[SKREDHENDELSE] AS h
        LEFT JOIN [skredprod].[skred].[SKREDTEKNISKEPARAMETRE] AS t ON t.[skredID] = h.[skredID]
        LEFT JOIN [skredprod].[skred].[UTLOPUTLOSNINGOMR] AS u ON u.[skredID] = h.[skredID]
        WHERE h.[skredTidspunkt] >= ?
            AND h.[skredTidspunkt] < ?
            AND h.[registrertAv] = 'Sentinel-1'
            AND h.[regStatus] != 'Slettet'
        ORDER BY t.[registrertDato] DESC
    """

    start, end = date_parse(request)
    return geo_query(q, [start, end])


@app.route('/api/events/polygons/within/<w>/<s>/<e>/<n>/')
def events_within(w, s, e, n):
    q = f"""
        SELECT
            h.[skredType],
            h.[skredTidspunkt],
            h.[noySkredTidspunkt],
            h.[registrertDato],
            h.[registrertAv],
            h.[regStatus],
            t.[skredAreal_m2],
            t.[eksposisjonUtlopsomr],
            t.[snittHelningUtlopssomr_gr],
            t.[maksHelningUtlopsomr_gr],
            t.[minHelningUtlopsomr_gr],
            t.[hoydeStoppSkred_moh],
            t.[noyHoydeStoppSkred],
            h.[skredID],
            u.[SHAPE].STAsBinary() AS geom
        FROM [skredprod].[skred].[SKREDHENDELSE] AS h
        LEFT JOIN [skredprod].[skred].[SKREDTEKNISKEPARAMETRE] AS t ON t.[skredID] = h.[skredID]
        LEFT JOIN [skredprod].[skred].[UTLOPUTLOSNINGOMR] AS u ON u.[skredID] = h.[skredID]
        WHERE u.[SHAPE].STIntersects(geometry::STPolyFromText(?, ?)) = 1
            AND h.[skredTidspunkt] >= ?
            AND h.[skredTidspunkt] < ?
            AND h.[registrertAv] = 'Sentinel-1'
            AND h.[regStatus] != 'Slettet'
        ORDER BY t.[registrertDato] DESC
    """

    start, end = date_parse(request)
    w, s, e, n = float(w), float(s), float(e), float(n)
    bbox = f'POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))'
    return geo_query(q, [bbox, EPSG, start, end])

@app.route('/api/events/points/')
def events_point_within():
    q = f"""
        SELECT
            h.[skredType],
            h.[skredTidspunkt],
            h.[noySkredTidspunkt],
            h.[registrertDato],
            h.[registrertAv],
            h.[regStatus],
            h.[skredID],
            h.[SHAPE].STAsBinary() as geom
        FROM [skredprod].[skred].[SKREDHENDELSE] AS h
        WHERE h.[skredTidspunkt] >= ?
            AND h.[skredTidspunkt] < ?
            AND h.[registrertAv] = 'Sentinel-1'
            AND h.[regStatus] != 'Slettet'
        ORDER BY h.[skredTidspunkt] DESC
    """

    start, end = date_parse(request)
    return geo_query(q, [start, end])

@app.route('/api/events/points/within/<w>/<s>/<e>/<n>/')
def events_point(w, s, e, n):
    q = f"""
        SELECT
            h.[skredType],
            h.[skredTidspunkt],
            h.[noySkredTidspunkt],
            h.[registrertDato],
            h.[registrertAv],
            h.[regStatus],
            h.[skredID],
            h.[SHAPE].STAsBinary() as geom
        FROM [skredprod].[skred].[SKREDHENDELSE] AS h
        WHERE h.[SHAPE].STIntersects(geometry::STPolyFromText(?, ?)) = 1
            AND h.[skredTidspunkt] >= ?
            AND h.[skredTidspunkt] < ?
            AND h.[registrertAv] = 'Sentinel-1'
            AND h.[regStatus] != 'Slettet'
        ORDER BY h.[skredTidspunkt] DESC
    """

    start, end = date_parse(request)
    w, s, e, n = float(w), float(s), float(e), float(n)
    bbox = f'POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))'
    return geo_query(q, [bbox, EPSG, start, end])

def date_parse(request):
    start_date = request.args.get('start')
    start = dt.date.fromisoformat(request.args['start']).isoformat() if start_date else '2000-01-01'
    end_date = request.args.get('end')
    if end_date:
        end = dt.date.fromisoformat(end_date).isoformat()
    elif start_date:
        end = (dt.date.fromisoformat(start) + dt.timedelta(days=1)).isoformat()
    else:
        end = '2100-01-01'
    return start, end

def geo_query(q, params):

    with sql() as cursor:
        gdf = gpd.GeoDataFrame.from_postgis(q, cursor, crs=EPSG, params=params)
        response = app.response_class(
            response=gdf.to_json(),
            status=200,
            mimetype='application/json'
        )
        return response

if __name__ == '__main__':
    app.run()