# data.py ── All mock data + rule-based logic. No ML, no external APIs.

from datetime import datetime, timedelta

# ── Date labels ──────────────────────────────────────────────────────────────
DAYS = [(datetime.today() - timedelta(days=6 - i)).strftime("%a %d") for i in range(7)]
FUTURE_DAYS = [(datetime.today() + timedelta(days=i + 1)).strftime("%a %d") for i in range(7)]
ALL_DAYS = DAYS + FUTURE_DAYS

# ── Default 7-day waste history (kg/day) ─────────────────────────────────────
WASTE_DEFAULTS = {
    "plastic": [12, 15, 11, 18, 14, 20, 16],
    "organic": [35, 40, 38, 42, 36, 45, 39],
    "ewaste":  [2,  1,  3,  1,  2,  4,  2],
}

# ── Thresholds ────────────────────────────────────────────────────────────────
THRESHOLDS = {
    "plastic": {"warning": 14, "critical": 18},
    "organic": {"warning": 38, "critical": 44},
    "ewaste":  {"warning": 2,  "critical": 3.5},
}

LABELS = {
    "plastic": "🧴 Plastic",
    "organic": "🍃 Organic",
    "ewaste":  "⚡ E-Waste",
}

# ── Classify a value for a given waste type ───────────────────────────────────
def classify(wtype, val):
    t = THRESHOLDS[wtype]
    if val >= t["critical"]: return "critical"
    if val >= t["warning"]:  return "warning"
    return "good"

# ── 7-day linear projection ───────────────────────────────────────────────────
def project_waste(values, reduction_pct=0):
    slope = (values[-1] - values[0]) / 6
    future = []
    for i in range(1, 8):
        v = values[-1] + slope * i
        v *= (1 - reduction_pct / 100)
        future.append(max(0, round(v, 2)))
    return future

# ── Solution cards (rule-based) ───────────────────────────────────────────────
SOLUTIONS = {
    "plastic": {
        "critical": {
            "headline": "Plastic is CRITICALLY high — immediate action needed",
            "actions": [
                ("🚫", "Ban single-use plastics in canteen", "Est. −35% plastic in 2 weeks"),
                ("📦", "Switch vendors to biodegradable packaging", "Est. −20% in 1 month"),
                ("🏪", "Deploy refill stations at 5 campus points", "Est. −15% ongoing"),
            ],
            "reduction_pct": 35,
        },
        "warning": {
            "headline": "Plastic is elevated — intervention recommended",
            "actions": [
                ("⚠️", "Nudge canteen vendors on plastic packaging", "Est. −15% in 2 weeks"),
                ("♻️", "Add labelled plastic-only bins at entry points", "Est. −10% in 1 month"),
            ],
            "reduction_pct": 18,
        },
        "good": {
            "headline": "Plastic levels are healthy — maintain current practices",
            "actions": [
                ("✅", "Continue current waste segregation", "Keep monitoring weekly"),
            ],
            "reduction_pct": 5,
        },
    },
    "organic": {
        "critical": {
            "headline": "Organic waste is CRITICALLY high — act now",
            "actions": [
                ("🌱", "Install on-campus biogas digester", "Est. −40% organic in 1 month"),
                ("🍽️", "Implement canteen pre-ordering to cut food waste", "Est. −30% in 2 weeks"),
                ("📊", "Publish weekly waste audit results publicly", "Drives behavioural change"),
            ],
            "reduction_pct": 40,
        },
        "warning": {
            "headline": "Organic waste is elevated — moderate action needed",
            "actions": [
                ("🥗", "Introduce smaller portion options in canteen", "Est. −15%"),
                ("🐛", "Start vermicomposting pilot in garden area", "Est. −10%"),
            ],
            "reduction_pct": 20,
        },
        "good": {
            "headline": "Organic waste is well managed",
            "actions": [
                ("✅", "Consider composting surplus to generate manure", "Low effort, high value"),
            ],
            "reduction_pct": 5,
        },
    },
    "ewaste": {
        "critical": {
            "headline": "E-Waste is CRITICALLY high — audit required",
            "actions": [
                ("🔌", "Mandatory e-waste audit across all labs this week", "Baseline + compliance"),
                ("🏭", "Partner with certified recycler (Attero / Karo Sambhav)", "Est. −50% disposal"),
                ("📋", "Create asset tracking log for all electronic equipment", "Prevents future buildup"),
            ],
            "reduction_pct": 50,
        },
        "warning": {
            "headline": "E-Waste is elevated — collection drive needed",
            "actions": [
                ("📦", "Set up e-waste drop boxes in each department", "Est. −25%"),
                ("📢", "Run awareness drive on what counts as e-waste", "Behaviour change"),
            ],
            "reduction_pct": 25,
        },
        "good": {
            "headline": "E-Waste generation is low — schedule quarterly drives",
            "actions": [
                ("✅", "Quarterly collection drive with certified partner", "Best practice"),
            ],
            "reduction_pct": 5,
        },
    },
}

# ── Simulator: 12-month multi-scenario projection ─────────────────────────────
MONTHS = [f"Month {i}" for i in range(1, 13)]
SIM_BASE = {"plastic": 16, "organic": 39, "ewaste": 2.2}

def simulate(recycle_pct, waste_reduction_pct):
    """Rule-based scenarios: recycling lifts diversion; waste_reduction trims generation across streams."""
    results = {}
    r = recycle_pct / 200.0
    w = waste_reduction_pct / 220.0
    for wtype, base in SIM_BASE.items():
        current = [round(base * (1 + 0.008 * i), 2) for i in range(12)]
        worst = [round(base * (1 + 0.025 * i), 2) for i in range(12)]
        extra = (w * 0.15) if wtype == "plastic" else 0
        factor = max(0.28, 1.0 - r - w - extra)
        improved = [round(base * factor * (1 + 0.002 * i), 2) for i in range(12)]
        results[wtype] = {"current": current, "worst": worst, "improved": improved}
    return results

# ── Carpool data ──────────────────────────────────────────────────────────────
CARPOOL_USERS = [
    {"name": "Priya Deshmukh",     "from": "Pimpri",          "to": "Akurdi",       "time": "8:00 AM", "seats": 2},
    {"name": "Rohit Sharma",       "from": "Chinchwad",       "to": "Akurdi",       "time": "8:15 AM", "seats": 3},
    {"name": "Aditya Pawar",       "from": "Nigdi",           "to": "Akurdi",       "time": "8:00 AM", "seats": 2},
    {"name": "Meera Kulkarni",     "from": "Pimpri",          "to": "Akurdi",       "time": "8:30 AM", "seats": 1},
    {"name": "Vishal Bhosale",     "from": "Bopkhel",         "to": "Akurdi",       "time": "7:45 AM", "seats": 3},
    {"name": "Sneha Joshi",        "from": "Wakad",           "to": "Hinjewadi",    "time": "9:00 AM", "seats": 1},
    {"name": "Tanvi Patil",        "from": "Ravet",           "to": "Hinjewadi",    "time": "9:15 AM", "seats": 2},
    {"name": "Karan More",         "from": "Chinchwad",       "to": "Pune Station", "time": "8:00 AM", "seats": 2},
    {"name": "Sahil Kulkarni",     "from": "Pimple Saudagar", "to": "Akurdi",       "time": "8:00 AM", "seats": 1},
    {"name": "Deepa Nair",         "from": "Akurdi",          "to": "Pimpri",       "time": "5:30 PM", "seats": 2},
]

DISTANCES = {
    ("Pimpri", "Akurdi"): 4.5,
    ("Chinchwad", "Akurdi"): 3.8,
    ("Nigdi", "Akurdi"): 2.9,
    ("Bopkhel", "Akurdi"): 2.1,
    ("Wakad", "Hinjewadi"): 5.0,
    ("Ravet", "Hinjewadi"): 6.5,
    ("Pimple Saudagar", "Akurdi"): 5.2,
    ("Chinchwad", "Pune Station"): 14.0,
    ("Akurdi", "Pimpri"): 4.5,
}

def get_distance(a, b):
    key = (a.strip().title(), b.strip().title())
    return DISTANCES.get(key) or DISTANCES.get((key[1], key[0])) or 6.0

def match_carpools(origin, dest):
    o, d = origin.strip().lower(), dest.strip().lower()
    return [
        u for u in CARPOOL_USERS
        if (o in u["from"].lower() or u["from"].lower() in o)
        and (d in u["to"].lower() or u["to"].lower() in d)
    ]

def compute_impact(dist_km, n_matches=1, days=22):
    # Avg car: 0.21 kg CO2/km, 0.08 L/km, ₹8/km
    share = max(n_matches, 1)
    fuel  = round(dist_km * 0.08 * days, 1)
    co2   = round(dist_km * 0.21 * days, 1)
    cost  = int(dist_km * 8 * days)
    trees = round(co2 / 21, 2)
    return {"fuel": fuel, "co2": co2, "cost": cost, "trees": trees}
