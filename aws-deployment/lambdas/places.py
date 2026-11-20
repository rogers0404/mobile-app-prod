"""
Places Lambda
Routes:
  GET /api/places/search
  GET /api/places/details
  GET /api/directions
"""
import os
import httpx
from common.db import get_secret, ok, err

GOOGLE_MAPS_SECRET_ARN = os.getenv('GOOGLE_MAPS_SECRET_ARN')


def _maps_key():
    return get_secret(GOOGLE_MAPS_SECRET_ARN)['api_key']


def lambda_handler(event, context):
    path = event.get('path', event.get('rawPath', ''))
    qs = event.get('queryStringParameters') or {}

    if '/places/search' in path:
        return search_places(qs)
    if '/places/details' in path:
        return place_details(qs)
    if '/directions' in path:
        return directions(qs)

    return err('Not found', 404)


def search_places(qs):
    query = qs.get('query', '')
    if not query:
        return err('query is required')

    params = {
        'input': query,
        'key': _maps_key(),
        'types': 'geocode|establishment',
    }
    lat, lon = qs.get('latitude'), qs.get('longitude')
    if lat and lon:
        params['location'] = f'{lat},{lon}'
        params['radius'] = '50000'

    try:
        resp = httpx.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', params=params)
        return ok(resp.json().get('predictions', []))
    except Exception as e:
        return err(str(e), 500)


def place_details(qs):
    place_id = qs.get('place_id')
    if not place_id:
        return err('place_id is required')

    try:
        resp = httpx.get('https://maps.googleapis.com/maps/api/place/details/json', params={
            'place_id': place_id,
            'key': _maps_key(),
            'fields': 'geometry,formatted_address,name',
        })
        data = resp.json()
        result = data.get('result')
        if not result:
            return err('Place not found', 404)
        return ok({
            'lat': result['geometry']['location']['lat'],
            'lng': result['geometry']['location']['lng'],
            'address': result.get('formatted_address', ''),
            'name': result.get('name', ''),
        })
    except Exception as e:
        return err(str(e), 500)


def directions(qs):
    try:
        resp = httpx.get('https://maps.googleapis.com/maps/api/directions/json', params={
            'origin': f"{qs['origin_lat']},{qs['origin_lng']}",
            'destination': f"{qs['dest_lat']},{qs['dest_lng']}",
            'key': _maps_key(),
            'mode': 'driving',
        })
        data = resp.json()
        if data.get('status') != 'OK' or not data.get('routes'):
            return ok({'status': data.get('status', 'ERROR'), 'error': 'No routes found'})

        import re
        leg = data['routes'][0]['legs'][0]
        steps = [{
            'instruction': re.sub(r'<[^>]*>', '', s.get('html_instructions', '')),
            'distance': s.get('distance', {}).get('text', ''),
            'duration': s.get('duration', {}).get('text', ''),
            'maneuver': s.get('maneuver', ''),
            'start_location': s.get('start_location', {}),
            'end_location': s.get('end_location', {}),
        } for s in leg.get('steps', [])]

        return ok({
            'status': 'OK',
            'duration': leg.get('duration', {}).get('text', ''),
            'distance': leg.get('distance', {}).get('text', ''),
            'steps': steps,
            'overview_polyline': data['routes'][0].get('overview_polyline', {}).get('points', ''),
        })
    except Exception as e:
        return err(str(e), 500)
