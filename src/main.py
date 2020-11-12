from settings import SETTINGS
from flask import Flask, request
from waitress import serve
import time
import pandas as pd
import geopandas as gpd
import pyodbc
import re
import requests
import sys
import datetime as dt
import multiprocessing
import contextlib

EPSG = 32633

def pool(connection_string):
    """Database pool for a multi-threaded server.

    :param connection_string: pyodbc connection string.
    :return: SQL connection generator
    """
    intital = 20
    connections = []
    local_pool = multiprocessing.Queue()
    for _ in range(0, intital):
        connections.append(pyodbc.connect(connection_string))
    n = multiprocessing.Value('i', intital - 1)

    @contextlib.contextmanager
    def pooled(reinit=False):
        try:
            idx = local_pool.get(False)
            if reinit:
                connections[idx].close()
                connections[idx] = pyodbc.connect(connection_string)
        except multiprocessing.queues.Empty:
            with n.get_lock():
                n.value += 1
                idx = n.value
                connections.append(None)
            connections[idx] = pyodbc.connect(connection_string)
        yield connections[idx]
        local_pool.put(idx)

    return pooled


app = Flask(__name__, static_folder='../static', static_url_path='/static')
sql = pool(f'Driver={{{SETTINGS["DB_DRIVER"]}}};'
           f'Server={SETTINGS["DB_HOST"]};'
           f'Database={SETTINGS["DB_DATABASE"]};'
           f'DOMAIN={SETTINGS["DB_DOMAIN"]};'
           f'UID={SETTINGS["DB_USERNAME"]};'
           f'PWD={SETTINGS["DB_PASSWORD"]};'
           f'Trusted_Connection={"yes" if SETTINGS["DB_TRUSTED"] else "no"};')


@app.route('/')
def root():
    """
    :return: Main page.
    """
    return app.send_static_file('html/index.html')


@app.route('/api/events/polygons/')
def events():
    """ Return full avalanche events with polygon geometries and avalanche parameters.

    :return: GeoJSONFeatureCollection<Polygon>
    """
    q = f"""
        SELECT
            h.skredID,
            h.skredTidspunkt,
            h.noySkredTidspunkt,
            t.eksposisjonUtlopsomr,
            t.minHelningUtlopsomr_gr,
            t.maksHelningUtlopsomr_gr,
            t.snittHelningUtlopssomr_gr,
            t.hoydeStoppSkred_moh,
            t.noyHoydeStoppSkred,
            h.regStatus,
            h.registrertDato,
            (SELECT MAX(v) FROM (VALUES (h.endretDato), (t.endretDato), (u.endretDato)) AS value(v)) as endretDato,
            u.shape.STArea() AS area,
            u.SHAPE.STAsBinary() AS geom
        FROM skredprod.skred.SKREDHENDELSE AS h
        LEFT JOIN skredprod.skred.SKREDTEKNISKEPARAMETRE AS t ON t.skredID = h.skredID
        LEFT JOIN skredprod.skred.UTLOPUTLOSNINGOMR AS u ON u.skredID = h.skredID
        WHERE h.skredTidspunkt >= ?
            AND h.skredTidspunkt < ?
            AND h.registrertAv = 'Sentinel-1'
            AND h.regStatus != 'Slettet'
        ORDER BY t.registrertDato DESC
    """

    start, end = date_parse(request)
    return geo_query(q, [start, end])


@app.route('/api/events/polygons/within/<w>/<s>/<e>/<n>/')
def events_within(w, s, e, n):
    """ Return full avalanche events with polygon geometries and avalanche parameters Filtered by BBox.

    :param w: Western boundary
    :param s: Southern boundary
    :param e: Eastern boundary
    :param n: Northen boundary
    :return: GeoJSONFeatureCollection<Polygon>
    """
    q = f"""
        SELECT
            h.skredID,
            h.skredTidspunkt,
            h.noySkredTidspunkt,
            t.eksposisjonUtlopsomr,
            t.minHelningUtlopsomr_gr,
            t.maksHelningUtlopsomr_gr,
            t.snittHelningUtlopssomr_gr,
            t.hoydeStoppSkred_moh,
            t.noyHoydeStoppSkred,
            h.regStatus,
            h.registrertDato,
            (SELECT MAX(v) FROM (VALUES (h.endretDato), (t.endretDato), (u.endretDato)) AS value(v)) as endretDato,
            u.shape.STArea() AS area,
            u.SHAPE.STAsBinary() AS geom
        FROM skredprod.skred.SKREDHENDELSE AS h
        LEFT JOIN skredprod.skred.SKREDTEKNISKEPARAMETRE AS t ON t.skredID = h.skredID
        LEFT JOIN skredprod.skred.UTLOPUTLOSNINGOMR AS u ON u.skredID = h.skredID
        WHERE u.SHAPE.STIntersects(geometry::STPolyFromText(?, ?)) = 1
            AND h.skredTidspunkt >= ?
            AND h.skredTidspunkt < ?
            AND h.registrertAv = 'Sentinel-1'
            AND h.regStatus != 'Slettet'
        ORDER BY t.registrertDato DESC
    """

    start, end = date_parse(request)
    w, s, e, n = float(w), float(s), float(e), float(n)
    bbox = f'POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))'
    return geo_query(q, [bbox, EPSG, start, end])


@app.route('/api/events/points/')
def events_point_within():
    """ Return simpler avalanche events, with point geometries.

    :return: GeoJSONFeatureCollection<Polygon>
    """
    q = f"""
        SELECT
            h.skredID,
            h.skredTidspunkt,
            h.noySkredTidspunkt,
            h.regStatus,
            h.registrertDato,
            h.endretDato,
            h.SHAPE.STAsBinary() AS geom
        FROM skredprod.skred.SKREDHENDELSE AS h
        WHERE h.skredTidspunkt >= ?
            AND h.skredTidspunkt < ?
            AND h.registrertAv = 'Sentinel-1'
            AND h.regStatus != 'Slettet'
        ORDER BY h.skredTidspunkt DESC
    """

    start, end = date_parse(request)
    return geo_query(q, [start, end])


@app.route('/api/events/points/within/<w>/<s>/<e>/<n>/')
def events_point(w, s, e, n):
    """ Return simpler avalanche events, with point geometries. Filtered by BBox.

    :param w: Western boundary
    :param s: Southern boundary
    :param e: Eastern boundary
    :param n: Northen boundary
    :return: GeoJSONFeatureCollection<Polygon>
    """
    q = f"""
        SELECT
            h.skredID,
            h.skredTidspunkt,
            h.noySkredTidspunkt,
            h.regStatus,
            h.registrertDato,
            h.endretDato,
            h.SHAPE.STAsBinary() AS geom
        FROM skredprod.skred.SKREDHENDELSE AS h
        WHERE h.SHAPE.STIntersects(geometry::STPolyFromText(?, ?)) = 1
            AND h.skredTidspunkt >= ?
            AND h.skredTidspunkt < ?
            AND h.registrertAv = 'Sentinel-1'
            AND h.regStatus != 'Slettet'
        ORDER BY h.skredTidspunkt DESC
    """

    start, end = date_parse(request)
    w, s, e, n = float(w), float(s), float(e), float(n)
    bbox = f'POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))'
    return geo_query(q, [bbox, EPSG, start, end])

@app.route('/api/baat/nib')
def baat_nib():
    for regex in SETTINGS['REFERERS']:
        if request.referrer and re.match(regex, request.referrer):
            url = "".join([
                "https://baat.geonorge.no/skbaatts/req?",
                "retformat=s&",
                f"brukerid={SETTINGS['BAAT_USERNAME']}&"
                f"passord={SETTINGS['BAAT_PASSWORD']}&"
                "tjenesteid=wms.nib"
            ])
            sec_req = requests.get(url)
            if sec_req.status_code == 200:
                return sec_req.text
            break
    return app.response_class(
        status=403,
    )

def date_parse(request):
    """ Determine if date parameters are present in the GET parameters of the request.

    :param request: Flask request object.
    :return: (string, string): Datestring of the formae yyyy-mm-dd
    """
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


def geo_query(q, params, reinit=False, delay=None):
    """ Make a query to the database, transform it into a FeatureCollection and make it into a Flask response.

    :param q: Database prepared statement
    :param params: Prepared statement parameters
    :param reinit: Drop existing database connection and reconnect. Only used in recursive calls.
    :param delay: Delay query by specified amount of seconds. Only used in recursive calls.
    :return: Flask resonse
    """
    try:
        if delay:
            time.sleep(delay)
        with sql(reinit) as connection:
            gdf = gpd.GeoDataFrame.from_postgis(q, connection, crs=EPSG, params=params)
            response = app.response_class(
                response=gdf.to_json(),
                status=200,
                mimetype='application/json'
            )
            return response
    except pd.io.sql.DatabaseError:
        if delay is None:
            delay = 0
        elif delay == 0:
            delay = 1
        elif delay < 64:
            delay *= 2
        return geo_query(q, params, reinit=True, delay=delay)


if __name__ == '__main__':
    port = int(sys.argv[1])
    serve(app, host='0.0.0.0', port=port, threads=20)