# FlipperAI — House Flipping Helper

An AI-powered house flipping and real estate investment advisor. Runs locally on your PC via a web browser, and works on Android out of the box via mobile browser.

## Features

- **AI Advisor** — Conversational agent (Claude Opus 4.6) with deep knowledge of house flipping, home buying, repair costs, and investment strategy
- **Deal Analyzer** — ROI, profit, annualized return, 70% rule check, deal scorecard
- **Repair Estimator** — Scope-based repair cost estimates with 15% contingency
- **Closing Cost Calculator** — Itemized buyer/seller closing costs by state
- **Document Vault** — Upload PDFs, contracts, inspection reports, contractor bids — AI reads and summarizes them
- **Property Manager** — Track your deal pipeline with per-property data and documents
- **PWA Ready** — Installable on Android home screen via Chrome "Add to Home Screen"

## Quick Start

### 1. Get an Anthropic API Key
Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.

### 2. Set your API key
```bash
# Option A: environment variable
export ANTHROPIC_API_KEY=sk-ant-...

# Option B: .env file (recommended)
echo "ANTHROPIC_API_KEY=sk-ant-..." > house-flipper/.env
```

### 3. Run
```bash
cd house-flipper
chmod +x start.sh
./start.sh
```

Open **http://localhost:8000** in your browser.

### Manual setup (without the script)
```bash
cd house-flipper/backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-ant-... ../.venv/bin/python main.py
```

## Android / Mobile Access

**Same WiFi network:** Run the server on your PC, then open `http://<your-pc-ip>:8000` in Chrome on your Android phone.

**Install as PWA:** In Chrome on Android, tap ⋮ → "Add to Home Screen" for a native-app-like experience.

## Project Structure

```
house-flipper/
├── backend/
│   ├── main.py              # FastAPI app + routes
│   ├── agent.py             # Claude AI agent with tool use
│   ├── calculator.py        # ROI, closing cost, repair calculations
│   ├── database.py          # SQLite (properties, docs, conversations)
│   ├── document_handler.py  # PDF/text extraction + AI summarization
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Single-page app
│   ├── css/style.css        # Dark theme, mobile-responsive
│   ├── js/app.js            # Frontend logic
│   └── manifest.json        # PWA manifest
├── data/                    # Auto-created: flipper.db + uploads/
├── start.sh                 # One-command startup
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Claude Opus 4.6 (Anthropic) with tool use + adaptive thinking |
| Backend | Python + FastAPI |
| Database | SQLite via aiosqlite |
| Document Parsing | pdfplumber |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Android | Mobile browser / PWA |

## Roadmap Ideas

- [ ] Market data integration (Zillow API, MLS via RETS)
- [ ] Comparable sales (comps) lookup
- [ ] Contractor contact book with bid comparison
- [ ] Photo upload for property/repair documentation
- [ ] Export deals to PDF report
- [ ] Native Android app (via Capacitor wrapper)
- [ ] Multi-user support with authentication
