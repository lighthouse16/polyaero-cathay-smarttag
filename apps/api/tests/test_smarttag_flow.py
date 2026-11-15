from httpx import AsyncClient


async def test_list_and_get_baggage(client: AsyncClient):
    res = await client.get("/api/v1/baggage")
    assert res.status_code == 200
    bags = res.json()
    assert len(bags) >= 10

    detail = await client.get(f"/api/v1/baggage/{bags[0]['tag_number']}")
    assert detail.status_code == 200
    assert detail.json() == bags[0]


async def test_nfc_sync_and_eink_display_payload(client: AsyncClient):
    sync_res = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_number": "0160892012",
            "tag_code": "SEED-20261114-00",
            "passenger_name": "CHAN/TIMOTHY",
            "flight_number": "CX888",
            "departure_airport": "HKG",
            "arrival_airport": "YVR",
            "cabin_class": "PRIORITY J",
            "weight_kg": 22.4,
            "initial_status": "SYNCHRONIZED",
        },
    )
    assert sync_res.status_code == 200
    assert sync_res.json()["is_tag_synced"] is True

    disp_res = await client.get("/api/v1/tags/SEED-20261114-00/display")
    assert disp_res.status_code == 200
    data = disp_res.json()
    assert data["flight"] == sync_res.json()["flight_number"]
    assert data["destination"] == sync_res.json()["arrival_airport"]
    assert data["sync_state"] == "READY"


async def test_irrops_reroute_and_ai_risk_engine(client: AsyncClient):
    irrops_res = await client.post(
        "/api/v1/baggage/0160892012/irrops",
        json={"new_flight_number": "CX890", "reason": "Gate change / tight transfer"},
    )
    assert irrops_res.status_code == 200
    body = irrops_res.json()
    assert body["flight_number"] == "CX890"
    assert body["eink_banner"] == "UPDATED ROUTE | CX890"
    assert body["is_rush_bag"] is True

    risk_res = await client.post(
        "/api/v1/baggage/risk/predict",
        json={
            "flight_number": "CX890",
            "origin": "HKG",
            "destination": "YVR",
            "transfer_minutes": 35,
            "weather_severity": 4,
            "load_factor_pct": 94.0,
            "airport_congestion": 4,
        },
    )
    assert risk_res.status_code == 200
    risk = risk_res.json()
    assert risk["risk_level"] == "HIGH_PRIORITY"
    assert risk["conveyor_action"] == "DIVERT_TO_EXPRESS_TRANSFER_CHUTE"
