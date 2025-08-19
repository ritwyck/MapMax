import math
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)


def latlon_to_xyz(lat, lon):
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    x = math.cos(lat_rad) * math.cos(lon_rad)
    y = math.cos(lat_rad) * math.sin(lon_rad)
    z = math.sin(lat_rad)
    return x, y, z


def xyz_to_latlon(x, y, z):
    hyp = math.hypot(x, y)
    lat = math.degrees(math.atan2(z, hyp))
    lon = math.degrees(math.atan2(y, x))
    return lat, lon


def both_spherical_midpoints(lat1, lon1, lat2, lon2):
    x1, y1, z1 = latlon_to_xyz(lat1, lon1)
    x2, y2, z2 = latlon_to_xyz(lat2, lon2)
    xm, ym, zm = (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2
    norm = math.sqrt(xm**2 + ym**2 + zm**2)
    xm, ym, zm = xm / norm, ym / norm, zm / norm
    mid_lat, mid_lon = xyz_to_latlon(xm, ym, zm)
    anti_lat, anti_lon = xyz_to_latlon(-xm, -ym, -zm)
    return (mid_lat, mid_lon), (anti_lat, anti_lon)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/calculate_midpoints', methods=['POST'])
def calculate_midpoints():
    data = request.json
    points = data.get('points', [])
    if len(points) < 2:
        return jsonify({'error': 'Please add at least two points.'}), 400
    n = len(points)
    midpoints = []
    for i in range(n):
        for j in range(i + 1, n):
            lat1, lon1 = points[i]
            lat2, lon2 = points[j]
            (mid_lat, mid_lon), (anti_lat, anti_lon) = both_spherical_midpoints(
                lat1, lon1, lat2, lon2)
            midpoints.append({
                'type': 'great-circle',
                'lat': mid_lat,
                'lon': mid_lon,
                'pair': [i, j]
            })
            midpoints.append({
                'type': 'antipodal',
                'lat': anti_lat,
                'lon': anti_lon,
                'pair': [i, j]
            })
    return jsonify({'midpoints': midpoints})


@app.route('/geocode', methods=['GET'])
def geocode():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': query,
        'format': 'json',
        'addressdetails': 1,
        'limit': 5,
    }
    headers = {
        'User-Agent': 'MidpointApp/1.0 (your-email@example.com)'
    }
    try:
        response = requests.get(url, params=params, headers=headers)
        results = response.json()
        places = []
        for r in results:
            places.append({
                'display_name': r['display_name'],
                'lat': float(r['lat']),
                'lon': float(r['lon'])
            })
        return jsonify(places)
    except Exception:
        return jsonify([])


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)
