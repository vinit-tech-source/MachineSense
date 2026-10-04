import urllib.request
import json

data = json.dumps({
    "machine_id": "machine-004",
    "name": "New Machine",
    "location": "Factory Floor",
    "rated_power_kw": 5.0,
    "tariff_inr_per_kwh": 8.5
}).encode('utf-8')

req = urllib.request.Request("http://127.0.0.1:8001/api/machines", data=data, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req) as res:
        print(res.status)
        print(res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode('utf-8'))
