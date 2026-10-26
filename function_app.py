
import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo

import azure.functions as func

app = func.FunctionApp(
    http_auth_level=func.AuthLevel.FUNCTION
)

API_URL = "https://api.porssisahko.net/v2/price.json"
FINLAND = ZoneInfo("Europe/Helsinki")


def hae_hinta(aika):
    """Fetch the price for one hourly period."""
    aika_utc = aika.astimezone(timezone.utc)
    date = aika_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"{API_URL}?date={date}"

    req = Request(
        url,
        headers={"User-Agent": "PorssisahkoAzure/1.0"}
    )

    with urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8"))

    price = data.get("price")
    return float(price) if price is not None else None


@app.route(route="porssisahko", methods=["GET"])
def porssisahko(req: func.HttpRequest) -> func.HttpResponse:
    try:
        date_text = req.params.get("date")

        if date_text:
            try:
                paiva = datetime.strptime(
                    date_text, "%Y-%m-%d"
                ).date()
            except ValueError:
                return json_response(
                    {"error": "Use date format YYYY-MM-DD"},
                    400
                )
        else:
            paiva = datetime.now(FINLAND).date()

        alku = datetime(
            paiva.year, paiva.month, paiva.day,
            tzinfo=FINLAND
        )

        hinnat = []

        # Calculate each hour in Finnish local time.
        for i in range(24):
            aika = alku + timedelta(hours=i)

            try:
                hinta = hae_hinta(aika)
            except (HTTPError, URLError, TimeoutError, OSError,
                    ValueError) as exc:
                logging.warning(
                    "Price lookup failed for %s: %s",
                    aika.isoformat(), exc
                )
                hinta = None
            except Exception:
                logging.exception(
                    "Unexpected price lookup error at %s",
                    aika.isoformat()
                )
                hinta = None

            hinnat.append({
                "aika": aika.isoformat(),
                "loppu": (
                    aika + timedelta(hours=1)
                ).isoformat(),
                "hinta_snt_kwh": hinta,
                "tila": ""
            })

        kelvolliset = [
            item for item in hinnat
            if item["hinta_snt_kwh"] is not None
        ]

        nyt = datetime.now(FINLAND)

        for item in hinnat:
            aika = datetime.fromisoformat(item["aika"])
            if aika <= nyt < datetime.fromisoformat(item["loppu"]):
                item["tila"] = "NYT"

        halvin = None
        kallein = None

        if kelvolliset:
            halvin = min(
                kelvolliset,
                key=lambda x: x["hinta_snt_kwh"]
            )
            kallein = max(
                kelvolliset,
                key=lambda x: x["hinta_snt_kwh"]
            )

            for item in hinnat:
                if item is halvin:
                    item["tila"] = (
                        "HALVIN" if item["tila"] != "NYT"
                        else "NYT, HALVIN"
                    )
                if item is kallein:
                    item["tila"] = (
                        item["tila"] + ", KALLEIN"
                        if item["tila"]
                        else "KALLEIN"
                    )

        result = {
            "paiva": paiva.isoformat(),
            "aikavyohyke": "Europe/Helsinki",
            "yksikko": "snt/kWh",
            "hinnat": hinnat,
            "halvin": halvin,
            "kallein": kallein,
            "kelvollisia_hintoja": len(kelvolliset)
        }

        return json_response(result, 200)

    except Exception:
        logging.exception("Porssisahko endpoint failed")
        return json_response(
            {"error": "Internal server error"},
            500
        )


def json_response(data, status_code):
    return func.HttpResponse(
        body=json.dumps(data, ensure_ascii=False),
        status_code=status_code,
        mimetype="application/json"
    )
