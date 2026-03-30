# Smart Campus Sustainability Advisor

A decision-support dashboard for campus sustainability teams. Track waste pressure, forecast future trends, simulate policy interventions, match carpoolers, and analyze campus photos — all in one offline-capable web app.

Built for the **IQAC Software Development Competition 2026** at DYPCOE Akurdi under the theme of **Sustainability**.

---

## Demo

| Module | What it does |
|---|---|
| ♻️ Waste Intelligence | Sliders → live alerts → 14-day forecast → solutions → before/after comparison |
| 📈 Impact Lab | Policy levers → 12-month 3-scenario projection → CO₂ and trees saved |
| 🚗 Carpool Matcher | Search by origin → match cards → collective fuel and CO₂ impact |
| 🔍 Vision Scan | Upload campus photo → pixel analysis → impact score + action steps |

---

## Tech Stack

- **Backend** — Python, Flask
- **Frontend** — Vanilla JS, Chart.js 4
- **Image analysis** — PIL (Pillow), no ML model
- **Data** — Mock data only, all in `data.py`
- **Dependencies** — No database, no external APIs, fully offline

---

## Project Structure

```
smart_campus/
├── app.py                  # Flask app — routes + API endpoints
├── data.py                 # All mock data, thresholds, logic
├── requirements.txt
├── static/
│   ├── style.css
│   ├── waste.js            # Waste module logic + Chart.js
│   ├── simulator.js        # Simulator module
│   ├── carpool.js          # Carpool module
│   ├── vision.js           # Vision scan module
│   └── *.svg               # Illustrations
└── templates/
    ├── base.html
    ├── index.html          # Landing page
    ├── waste.html
    ├── simulator.html
    ├── carpool.html
    └── vision.html
```

---

## Setup

**Requirements:** Python 3.9+

```bash
# 1. Clone the repo
git clone https://github.com/your-username/smart-campus-sustainability.git
cd smart-campus-sustainability/smart_campus

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
python app.py
```

Open **http://localhost:5000** in your browser.

---

## API Endpoints

All endpoints accept POST with a JSON body and return JSON.

### `POST /api/waste`
```json
{ "plastic": 16, "organic": 39, "ewaste": 2 }
```
Returns: classification levels, 14-day chart data, solution cards per stream, before/after comparison payload.

### `POST /api/simulate`
```json
{ "recycle": 30, "reduce": 20 }
```
Returns: 12-month projections for current / improved / worst-case scenarios, and computed stats (waste avoided, CO₂ saved, trees equivalent).

### `POST /api/carpool`
```json
{ "origin": "Pimpri" }
```
Returns: matched commuters heading to DYPCOE Akurdi, per-match impact stats, collective fuel and CO₂ totals.

### `POST /api/vision-analyze`
```
multipart/form-data  →  image: <file>
```
Returns: scene category, impact score, severity, visual signal metrics, material mix, and action recommendations.

---

## How the Logic Works

### Waste Classification
Each waste stream has two thresholds — `warning` and `critical` — defined in `data.py`. The API classifies the input value against these and returns the appropriate level, solution set, and projected reduction percentage.

### Forecast Projection
A simple linear slope is calculated from the 7-day history. The projection extends this slope forward 7 days. No smoothing, no ML.

### Simulator Scenarios
- **Current** — baseline growing at +0.8%/month
- **Worst case** — no action, growing at +2.5%/month  
- **Improved** — baseline multiplied by a reduction factor derived from the recycling and waste-reduction slider values

### Carpool Matching
Fuzzy string match on origin against a pool of 10 mock commuters. If your input is contained in a commuter's `from` field (or vice versa), it's a match. Destination is fixed to Akurdi.

### Vision Scan
PIL resizes the uploaded image to 180×180 and computes pixel statistics:

| Metric | What it measures |
|---|---|
| Brightness | Mean R+G+B — dark scenes suggest e-waste, warm bright scenes suggest organic |
| Texture complexity | Pixel variance ÷ 28 — high = cluttered/mixed materials |
| Green signal | % of pixels where green channel dominates — high = maintained campus zone |
| Warm bias | Red channel dominance — used to detect organic/food waste areas |

These four signals map to one of four categories: **plastic**, **organic**, **ewaste**, or **green**. Once classified, fixed thresholds produce the impact score, confidence, severity, and handling risk values. The material mix in the doughnut chart is a preset representative estimate per category, not a per-pixel count.

---

## Waste Thresholds

| Stream | Warning | Critical |
|---|---|---|
| Plastic | 14 kg/day | 18 kg/day |
| Organic | 38 kg/day | 44 kg/day |
| E-Waste | 2 kg/day | 3.5 kg/day |

---

## Notes

- All data is mock/dummy. The pipeline is built to be swapped in with real sensor or ERP data at any integration point.
- Vision Scan uses no trained model — it is a rule-based pixel heuristic designed to demonstrate offline sustainability triage.
- The carpool destination is hardcoded to DYPCOE Akurdi for this demo. The matching logic is generic and can be extended to any destination.

---

## Requirements

```
flask
pillow
```

Full list in `requirements.txt`.

---

## License

MIT
