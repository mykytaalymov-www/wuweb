"""Read-only/negative HTTP checks for a deployed staging API with payment disabled."""
import json
import sys
import urllib.error
import urllib.request

base = sys.argv[1].rstrip('/')
origin = 'https://wuisthequestion.com'

def call(path, method='GET', data=None, headers=None):
    request = urllib.request.Request(base + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', 'Origin': origin, **(headers or {})})
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read().decode()
    return response.code, json.loads(raw) if raw else None, response.headers

status, health, _ = call('/health')
assert status == 200 and health['database'] and health['mode'] == 'test' and health['ready'] is False, health
print('PASS health: database connected; test mode; payment disabled')
item = {'size': 'S-M', 'quantity': 1}
for country, total, currency in [('PL', 72800, 'pln'), ('DE', 17900, 'eur')]:
    status, q, headers = call('/quote', 'POST', {'country': country, 'items': [item]})
    assert status == 200 and q['total'] == total and q['currency'] == currency, q
    assert headers['Access-Control-Allow-Origin'] == origin
    print('PASS final total', country, total, currency)
cases = [
    ('US unavailable', '/quote', {'country': 'US', 'items': [item]}, 422, 'shipping_unavailable', {}),
    ('FR unavailable', '/quote', {'country': 'FR', 'items': [item]}, 422, 'shipping_unavailable', {}),
    ('packing not confirmed', '/quote', {'country': 'PL', 'items': [{'size': 'M-L', 'quantity': 2}]}, 422, 'packing_confirmation_required', {}),
    ('amount injection', '/quote', {'country': 'PL', 'items': [item], 'amount': 1}, 400, 'invalid_order', {}),
    ('size injection', '/quote', {'country': 'PL', 'items': [{'size': 'XS', 'quantity': 1}]}, 400, 'invalid_items', {}),
    ('checkout disabled', '/checkout', {'country': 'PL', 'items': [item]}, 503, 'checkout_unavailable', {}),
    ('forged webhook', '/webhook', {}, 400, 'invalid_signature', {}),
    ('wrong origin', '/quote', {'country': 'PL', 'items': [item]}, 403, 'invalid_origin', {'Origin': 'https://evil.example'}),
    ('body limit', '/quote', {'pad': 'x' * 5000}, 413, 'body_too_large', {}),
]
for name, path, data, expected_status, expected_error, headers in cases:
    status, result, _ = call(path, 'POST', data, headers)
    assert status == expected_status and result['error'] == expected_error, (name, status, result)
    print('PASS', name)
status, result, _ = call('/orders/00000000-0000-4000-8000-000000000001')
assert status == 404 and result['error'] == 'order_not_found'
print('PASS unauthenticated order lookup')
status, _, headers = call('/quote', 'OPTIONS')
assert status == 204 and headers['Access-Control-Allow-Origin'] == origin
print('PASS CORS preflight')
print('14 deployed checks passed. No Stripe payment was created.')
