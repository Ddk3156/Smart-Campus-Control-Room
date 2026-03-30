"""
Smart Campus Sustainability Advisor — Flask
Run: python app.py → http://localhost:5000
"""

from __future__ import annotations

import io
from typing import List, Tuple

from flask import Flask, render_template, request, jsonify
from PIL import Image, ImageStat

from data import (
    ALL_DAYS,
    DAYS,
    FUTURE_DAYS,
    LABELS,
    THRESHOLDS,
    WASTE_DEFAULTS,
    SOLUTIONS,
    classify,
    project_waste,
    simulate,
    MONTHS,
    match_carpools,
    get_distance,
    compute_impact,
)

app = Flask(__name__)

DESTINATION_LABEL = "DYPCOE Akurdi"
DESTINATION_MATCH = "Akurdi"

# Mock contact details (not in data.py — appended at API layer only)
CONTACT_ROTATION = [
    {
        "email": "priya.d@dypcoe.edu.in",
        "phone": "+91 98765 43210",
        "branch": "Computer Engineering",
        "designation": "Student Coordinator",
    },
    {
        "email": "rohit.s@dypcoe.edu.in",
        "phone": "+91 91234 56780",
        "branch": "Mechanical Engineering",
        "designation": "IQAC Volunteer",
    },
    {
        "email": "aditya.p@dypcoe.edu.in",
        "phone": "+91 99887 76655",
        "branch": "E&TC",
        "designation": "Green Campus Lead",
    },
]

IMAGE_SUGGESTIONS = {
    "plastic": {
        "headline": "Likely plastic-heavy disposal zone",
        "impact_summary": "Visible disposable packaging can raise sorting load, contamination risk, and campus cleanup effort.",
        "actions": [
            "Place clearly labelled plastic-only bins near this area.",
            "Reduce single-use packaging from nearby vendors or kiosks.",
            "Run a 3-day cleanup and segregation audit for this location.",
        ],
    },
    "organic": {
        "headline": "Likely organic or food-waste hotspot",
        "impact_summary": "Food and compostable waste can quickly increase odor, pests, and avoidable landfill mass if not separated early.",
        "actions": [
            "Add food-scrap collection bins and daily pickup.",
            "Redirect canteen leftovers toward composting or biogas.",
            "Post visual signs to separate wet waste at source.",
        ],
    },
    "ewaste": {
        "headline": "Likely electronics or lab-material accumulation",
        "impact_summary": "Improper storage of wires, devices, or mixed electronic scrap increases safety and recycling compliance risk.",
        "actions": [
            "Create a dedicated e-waste holding point with labels.",
            "Schedule a certified recycler pickup for this batch.",
            "Log visible devices and loose components in an audit sheet.",
        ],
    },
    "green": {
        "headline": "Likely green or well-maintained campus zone",
        "impact_summary": "This area appears visually balanced and lower-risk, with stronger potential for awareness signage and preventive maintenance.",
        "actions": [
            "Maintain current housekeeping and segregation practices.",
            "Use this zone as a model area for awareness displays.",
            "Track weekly cleanliness scores to keep standards stable.",
        ],
    },
}


def _contact_for_index(i):
    return CONTACT_ROTATION[i % len(CONTACT_ROTATION)]


def _comparison_payload(plastic: float, organic: float, ewaste: float) -> dict:
    vals = {"plastic": plastic, "organic": organic, "ewaste": ewaste}
    worst_wtype = max(vals, key=lambda w: vals[w] / THRESHOLDS[w]["critical"])
    worst_lvl = classify(worst_wtype, vals[worst_wtype])
    reduction = SOLUTIONS[worst_wtype][worst_lvl]["reduction_pct"]

    def proj_weeks(val: float, pct_mitigate: float):
        slope = val * 0.028
        return [round(max(0.1, val + slope * i * (1 - pct_mitigate / 100)), 2) for i in range(8)]

    without = {w: proj_weeks(vals[w], 0) for w in vals}
    with_action = {
        w: proj_weeks(vals[w], reduction if w == worst_wtype else reduction * 0.35)
        for w in vals
    }
    return {
        "weeks": [f"Week {i + 1}" for i in range(8)],
        "without": without,
        "with": with_action,
        "reduction_pct": reduction,
        "focus_type": worst_wtype,
        "focus_label": LABELS[worst_wtype],
    }


def _waste_chart_datasets(plastic: float, organic: float, ewaste: float) -> Tuple[List[str], list]:
    vals = {"plastic": plastic, "organic": organic, "ewaste": ewaste}
    colors = {
        "plastic": {"hist": "#38bdf8", "proj": "#38bdf8"},
        "organic": {"hist": "#34d399", "proj": "#34d399"},
        "ewaste": {"hist": "#a78bfa", "proj": "#a78bfa"},
    }
    datasets = []
    for wtype, val in vals.items():
        hist = WASTE_DEFAULTS[wtype][:-1] + [val]
        proj = project_waste(hist)
        hist_data = hist + [None] * 7
        proj_data = [None] * 7 + proj
        lab = LABELS[wtype].replace("🧴 ", "").replace("🍃 ", "").replace("⚡ ", "")
        datasets.append(
            {
                "label": f"{lab} (history)",
                "data": hist_data,
                "borderColor": colors[wtype]["hist"],
                "backgroundColor": colors[wtype]["hist"] + "26",
                "borderDash": [],
                "fill": False,
                "tension": 0.35,
                "pointRadius": 3,
            }
        )
        datasets.append(
            {
                "label": f"{lab} (projection)",
                "data": proj_data,
                "borderColor": colors[wtype]["proj"],
                "backgroundColor": "transparent",
                "borderDash": [6, 4],
                "fill": False,
                "tension": 0.35,
                "pointRadius": 2,
            }
        )
    return ALL_DAYS, datasets


def _safe_open_image(file_storage) -> Image.Image:
    image_bytes = file_storage.read()
    file_storage.stream.seek(0)
    img = Image.open(io.BytesIO(image_bytes))
    return img.convert("RGB")


def _image_payload(img: Image.Image) -> dict:
    sample = img.resize((180, 180))
    stat = ImageStat.Stat(sample)
    mean_r, mean_g, mean_b = stat.mean
    brightness = (mean_r + mean_g + mean_b) / 3.0
    green_bias = mean_g - ((mean_r + mean_b) / 2)
    warm_bias = mean_r - mean_b
    variance = sum(stat.var) / 3.0

    tiny = sample.resize((48, 48))
    pixels = list(tiny.getdata())
    neutral = 0
    greenish = 0
    warmish = 0
    darkish = 0
    for r, g, b in pixels:
        if abs(r - g) < 18 and abs(g - b) < 18:
            neutral += 1
        if g > r + 8 and g > b + 8:
            greenish += 1
        if r > g + 12 and r > b + 16:
            warmish += 1
        if (r + g + b) / 3 < 70:
            darkish += 1

    total = max(1, len(pixels))
    green_ratio = greenish / total
    warm_ratio = warmish / total
    dark_ratio = darkish / total
    neutral_ratio = neutral / total

    if dark_ratio > 0.36 and variance > 1800:
        category = "ewaste"
        confidence = 78
        waste_mix = {"plastic": 18, "organic": 8, "ewaste": 74}
    elif warm_ratio > 0.34 and brightness > 105:
        category = "organic"
        confidence = 74
        waste_mix = {"plastic": 14, "organic": 72, "ewaste": 14}
    elif green_ratio > 0.30 and green_bias > 10:
        category = "green"
        confidence = 71
        waste_mix = {"plastic": 10, "organic": 18, "ewaste": 6}
    else:
        category = "plastic"
        confidence = 76 if neutral_ratio > 0.32 else 68
        waste_mix = {"plastic": 70, "organic": 18, "ewaste": 12}

    impact_score = round(
        min(
            96,
            max(
                18,
                (waste_mix["plastic"] * 0.8 + waste_mix["organic"] * 0.72 + waste_mix["ewaste"] * 0.95) / 1.9,
            ),
        ),
        1,
    )

    severity = "low"
    if impact_score >= 70:
        severity = "high"
    elif impact_score >= 42:
        severity = "moderate"

    carbon_note = round(impact_score * 0.18, 1)
    handling_note = round((variance / 1800) + (waste_mix["ewaste"] / 24), 1)

    return {
        "category": category,
        "confidence": confidence,
        "impact_score": impact_score,
        "severity": severity,
        "waste_mix": waste_mix,
        "metrics": {
            "brightness": round(brightness, 1),
            "texture_complexity": round(min(100, variance / 28), 1),
            "green_signal": round(max(0, green_ratio * 100), 1),
            "handling_risk": handling_note,
            "carbon_note": carbon_note,
        },
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/waste")
def waste_page():
    return render_template("waste.html")


@app.route("/simulator")
def simulator_page():
    return render_template("simulator.html")


@app.route("/carpool")
def carpool_page():
    return render_template("carpool.html")


@app.route("/vision")
def vision_page():
    return render_template("vision.html")


@app.route("/api/waste", methods=["POST"])
def api_waste():
    try:
        body = request.get_json(force=True, silent=True) or {}
        plastic = float(body.get("plastic", 16))
        organic = float(body.get("organic", 39))
        ewaste = float(body.get("ewaste", 2))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Invalid numeric input"}), 400

    plastic = max(0, min(40, plastic))
    organic = max(0, min(80, organic))
    ewaste = max(0, min(10, ewaste))

    levels = {}
    solutions_out = {}
    for wtype, val in [
        ("plastic", plastic),
        ("organic", organic),
        ("ewaste", ewaste),
    ]:
        lvl = classify(wtype, val)
        levels[wtype] = lvl
        sol = SOLUTIONS[wtype][lvl]
        solutions_out[wtype] = {
            "headline": sol["headline"],
            "level": lvl,
            "reduction_pct": sol["reduction_pct"],
            "actions": [
                {"icon": a[0], "title": a[1], "impact": a[2]}
                for a in sol["actions"]
            ],
        }

    labels, datasets = _waste_chart_datasets(plastic, organic, ewaste)

    pills = []
    for wtype, val in [
        ("plastic", plastic),
        ("organic", organic),
        ("ewaste", ewaste),
    ]:
        lvl = levels[wtype]
        if lvl == "critical":
            pill = {"text": "Critical", "tone": "danger", "emoji": "🔴"}
        elif lvl == "warning":
            pill = {"text": "Warning", "tone": "warn", "emoji": "🟡"}
        else:
            pill = {"text": "On track", "tone": "ok", "emoji": "🟢"}
        pills.append({"type": wtype, "label": LABELS[wtype], "pill": pill})

    comparison = _comparison_payload(plastic, organic, ewaste)

    return jsonify(
        {
            "ok": True,
            "labels": labels,
            "days_history": DAYS,
            "days_future": FUTURE_DAYS,
            "chart": {"labels": labels, "datasets": datasets},
            "levels": levels,
            "solutions": solutions_out,
            "status_strip": pills,
            "comparison": comparison,
        }
    )


@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    try:
        body = request.get_json(force=True, silent=True) or {}
        recycle = float(body.get("recycle", 30))
        reduce = float(body.get("reduce", 20))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Invalid input"}), 400

    recycle = max(0, min(80, recycle))
    reduce = max(0, min(60, reduce))

    results = simulate(recycle, reduce)
    total_current = [0] * 12
    total_improved = [0] * 12
    total_worst = [0] * 12
    for wtype in ("plastic", "organic", "ewaste"):
        for i in range(12):
            total_current[i] += results[wtype]["current"][i]
            total_improved[i] += results[wtype]["improved"][i]
            total_worst[i] += results[wtype]["worst"][i]

    avoided_kg = round(total_current[-1] - total_improved[-1], 2)
    avoided_kg = max(0, avoided_kg)
    co2_saved = round(avoided_kg * 0.42, 2)
    trees_eq = round(co2_saved / 21, 2)

    return jsonify(
        {
            "ok": True,
            "months": MONTHS,
            "totals": {
                "current": [round(x, 2) for x in total_current],
                "improved": [round(x, 2) for x in total_improved],
                "worst": [round(x, 2) for x in total_worst],
            },
            "by_type": results,
            "stats": {
                "waste_avoided_kg_day": avoided_kg,
                "co2_saved_kg_month": co2_saved,
                "trees_equivalent": trees_eq,
            },
        }
    )


@app.route("/api/carpool", methods=["POST"])
def api_carpool():
    try:
        body = request.get_json(force=True, silent=True) or {}
        origin = (body.get("origin") or "").strip()
    except TypeError:
        return jsonify({"ok": False, "error": "Invalid JSON"}), 400

    if not origin:
        return jsonify({"ok": False, "error": "Origin is required"}), 400

    matches_raw = match_carpools(origin, DESTINATION_MATCH)
    matches_out = []
    collective_fuel = 0.0
    collective_co2 = 0.0

    for i, u in enumerate(matches_raw):
        dist = get_distance(u["from"], u["to"])
        imp = compute_impact(dist, 1)
        collective_fuel += imp["fuel"]
        collective_co2 += imp["co2"]
        contact = _contact_for_index(i)
        matches_out.append(
            {
                "name": u["name"],
                "from": u["from"],
                "to": u["to"],
                "time": u["time"],
                "seats": u["seats"],
                "distance_km": dist,
                "impact": {
                    "fuel_l_month": imp["fuel"],
                    "co2_kg_month": imp["co2"],
                    "trees": imp["trees"],
                },
                "contact": contact,
            }
        )

    return jsonify(
        {
            "ok": True,
            "destination": DESTINATION_LABEL,
            "matches": matches_out,
            "collective": {
                "fuel_l_month": round(collective_fuel, 1),
                "co2_kg_month": round(collective_co2, 1),
            },
        }
    )


@app.route("/api/vision-analyze", methods=["POST"])
def api_vision_analyze():
    file_obj = request.files.get("image")
    if not file_obj or not file_obj.filename:
        return jsonify({"ok": False, "error": "Please upload an image file"}), 400

    try:
        img = _safe_open_image(file_obj)
    except Exception:
        return jsonify({"ok": False, "error": "Unsupported or invalid image file"}), 400

    payload = _image_payload(img)
    suggestion = IMAGE_SUGGESTIONS[payload["category"]]

    return jsonify(
        {
            "ok": True,
            "analysis": {
                "label": suggestion["headline"],
                "category": payload["category"],
                "confidence": payload["confidence"],
                "impact_score": payload["impact_score"],
                "severity": payload["severity"],
                "impact_summary": suggestion["impact_summary"],
                "metrics": payload["metrics"],
                "waste_mix": payload["waste_mix"],
                "actions": suggestion["actions"],
            },
        }
    )


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": "Not found"}), 404
    return ("Page not found", 404)


@app.errorhandler(500)
def server_err(e):
    if request.path.startswith("/api/"):
        return jsonify({"ok": False, "error": "Server error"}), 500
    return ("Something went wrong.", 500)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
