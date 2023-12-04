import json

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


@app.route('/api/events/polygons/within/<w>/<s>/<e>/<n>/')
def events_within(w, s, e, n):
    """ Return full avalanche events with polygon geometries and avalanche parameters Filtered by BBox.

    :param w: Western boundary
    :param s: Southern boundary
    :param e: Eastern boundary
    :param n: Northen boundary
    :return: GeoJSONFeatureCollection<Polygon>
    """
    regions = request.args.get("region")
    regions = regions.split(',') if regions else regions

    q = f"""
        SELECT
            h.skredID,
            h.skredTidspunkt,
            h.noySkredTidspunkt,
            r.OMRAADENAVN AS region,
            r.OMRAADEID AS regionId,
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
        LEFT JOIN skredprod.skred.Snoskred_Varslingsregioner AS r ON r.skredID = h.skredID
        WHERE h.SHAPE.STIntersects(geometry::STPolyFromText(?, ?)) = 1
            AND h.skredTidspunkt >= ?
            AND h.skredTidspunkt < ?
            AND h.registrertAv = 'Sentinel-1'
            AND h.regStatus != 'Slettet'
            {f'AND r.OMRAADEID IN ({",".join("?" * len(regions))})' if regions else ''}
        ORDER BY t.registrertDato DESC
    """

    start, end = date_parse(request)
    w, s, e, n = float(w), float(s), float(e), float(n)
    bbox = f'POLYGON (({w} {s}, {e} {s}, {e} {n}, {w} {n}, {w} {s}))'
    params = [bbox, EPSG, start, end]
    if regions:
        params += regions
    return geo_query(q, params)


@app.route('/api/events/points/')
def events_point_within():
    """ Return simpler avalanche events, with point geometries.

    :return: GeoJSONFeatureCollection<Polygon>
    """
    regions = request.args.get("region")
    regions = regions.split(',') if regions else regions

    q = f"""
        WITH Points (date, regionId, exp, exposition, elevation, precision)
        AS (
            SELECT
                CAST(CAST(h.skredTidspunkt AS date) AS VARCHAR(10)) AS date,
                r.OMRAADEID AS regionId,
                t.eksposisjonUtlopsomr AS exp,
                ((CAST(t.eksposisjonUtlopsomr as INT) + 360) * 10 + 225) / 450 % 8 as exposition,
                (t.hoydeStoppSkred_moh / 200) * 200 as elevation,
                h.noySkredTidspunkt
            FROM skredprod.skred.SKREDHENDELSE AS h
            LEFT JOIN skredprod.skred.SKREDTEKNISKEPARAMETRE AS t ON t.skredID = h.skredID
            LEFT JOIN skredprod.skred.Snoskred_Varslingsregioner AS r ON r.skredID = h.skredID
            WHERE h.skredTidspunkt >= ?
                AND h.skredTidspunkt < ?
                AND h.registrertAv = 'Sentinel-1'
                AND h.regStatus != 'Slettet'
                {f'AND r.OMRAADEID IN ({",".join("?" * len(regions))})' if regions else ''}
        ),
        Points_gt48 (date, regionId, exp, exposition, elevation)
        AS (
            SELECT date, regionId, exp, exposition, elevation
            FROM Points
            WHERE precision IN ('3 dager', '6 dager')
        ),
        Points_lte48 (date, regionId, exp, exposition, elevation)
        AS (
            SELECT date, regionId, exp, exposition, elevation
            FROM Points
            WHERE precision IN ('2 dager', '1 dager')
        ),
        Points_lt24 (date, regionId, exp, exposition, elevation)
        AS (
            SELECT date, regionId, exp, exposition, elevation
            FROM Points
            WHERE precision IN ('Eksakt', '1 min', '1 time', '4 timer', '6 timer', '12 timer')
        )
        SELECT
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', regionId, Count(*))
                FROM Points
                WHERE regionId IS NOT NULL
                GROUP BY regionId
                ORDER BY regionId
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS regions,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%s":%d', date, Count(*))
                FROM Points_gt48
                GROUP BY date
                ORDER BY date
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS dates_gt48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%s":%d', date, Count(*))
                FROM Points_lte48
                GROUP BY date
                ORDER BY date
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS dates_lte48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%s":%d', date, Count(*))
                FROM Points_lt24
                GROUP BY date
                ORDER BY date
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS dates_lt24,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', elevation, Count(*))
                FROM Points_gt48
                GROUP BY elevation
                ORDER BY elevation
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS elevations_gt48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', elevation, Count(*))
                FROM Points_lte48
                GROUP BY elevation
                ORDER BY elevation
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS elevations_lte48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', elevation, Count(*))
                FROM Points_lt24
                GROUP BY elevation
                ORDER BY elevation
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS elevations_lt24,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', exposition, Count(*))
                FROM Points_gt48
                GROUP BY exposition
                ORDER BY exposition
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS expositions_gt48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', exposition, Count(*))
                FROM Points_lte48
                GROUP BY exposition
                ORDER BY exposition
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS expositions_lte48,
            '{{' + STUFF((
                SELECT FORMATMESSAGE(',"%d":%d', exposition, Count(*))
                FROM Points_lt24
                GROUP BY exposition
                ORDER BY exposition
                FOR XML PATH ('')
            ), 1, 1, '') + '}}' AS expositions_lt24
    """

    start, end = date_parse(request)
    params = [start, end]
    if regions:
        params += regions
    columns, rows = query(q, params)
    d = {column: {} if value is None else json.loads(value) for column, value in zip(columns, rows[0])}
    response = app.response_class(
        response=json.dumps(d),
        status=200,
        mimetype='application/json'
    )
    return response


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


def query(q, params, reinit=False, delay=None):
    """ Make a query to the database and return columns and rows.

    :param q: Database prepared statement
    :param params: Prepared statement parameters
    :param reinit: Drop existing database connection and reconnect. Only used in recursive calls.
    :param delay: Delay query by specified amount of seconds. Only used in recursive calls.
    :return: Flask resonse
    """
    try:
        if delay:
            time.sleep(delay)
        with sql(reinit) as cursor:
            cursor = cursor.execute(q, params)
            columns = [column[0] for column in cursor.description]
            return columns, cursor.fetchall()
    except pd.io.sql.DatabaseError:
        if delay is None:
            delay = 0
        elif delay == 0:
            delay = 1
        elif delay < 64:
            delay *= 2
        return query(q, params, reinit=True, delay=delay)

if __name__ == '__main__':
    port = int(sys.argv[1])
    serve(app, host='0.0.0.0', port=port, threads=20)