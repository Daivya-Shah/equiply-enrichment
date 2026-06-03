# Equipment Enrichment

**Daivya Shah** | Equiply Hackathon Submission

[View Resume](https://www.daivyashah.com/assets/Daivya_Shah_Resume.pdf) &nbsp;&nbsp; [Download Enriched CSV](https://drive.google.com/file/d/1X3NJWGhNEGVAh2e2eT7NAirZ_aeC7fvD/view?usp=sharing)

---

## What I Built

I built a React application that takes a hospital equipment CSV (columns: `manufacturer`, `model`, `serial_number`) and enriches every row with two fields: `manufactured_date` (ISO 8601) and `device_type` (one of 13 standardized categories). The result is a sorted, filterable table with confidence scores, a device type distribution chart, a fleet age chart, and a one-click CSV export.

The input dataset had 801 rows across a wide range of medical device manufacturers. The application processes all of them concurrently, pulling from multiple data sources in a smart, layered way to fill in as many dates and device types as possible.

---

## My Approach: Accuracy First

My focus for this hackathon was enrichment accuracy, meaning getting the manufactured dates and device types as correct and defensible as possible, rather than polishing the UI. The reason is simple: if a hospital is using this data for capital replacement planning or compliance audits, a wrong date is worse than no date. So I built the system to be honest about what it knows and what it is guessing.

Every enriched row has:
- A `confidence` score (0.0 to 1.0) that reflects how much I trust the source
- A `source` field that tells you exactly where the data came from
- A `notes` field with a full audit trail, including the specific method used, any FDA K-number citations, and the production window bounds applied

The UI surfaces this through color-coded confidence badges (green for high, blue for medium, amber for low) and a tooltip on every row that shows the full audit trail. FDA 510(k) K-numbers in the notes are automatically linked to the FDA CDRH database.

---

## The Enrichment Pipeline

The core of the application is an 8-step waterfall in `src/lib/enrichRow.ts`. The first step that successfully produces a result wins, and the pipeline immediately moves on. Steps are skipped when their data source clearly will not add anything useful.

### Step 0 - Parallel Prefetch (fires immediately for every row)

Before the waterfall begins, two independent tasks fire in parallel using `Promise.all`:

1. **FDA 510(k) lookup** - queries the FDA 510(k) clearance database (or a pre-built static cache first) for the manufacturer and model. The 510(k) clearance date gives a hard floor: the device cannot have been manufactured before regulatory approval.
2. **Tavily web search + GPT serial decode** - searches the web for documentation on how this manufacturer encodes dates in their serial numbers, then passes that context to GPT to extract a manufacture date from the specific serial number.

These two tasks are completely independent so there is no reason to run them sequentially. Firing them in parallel cuts the per-row latency roughly in half for the rows that need both.

### Step 1 - Serial Date Extraction (Tavily + GPT)

This step uses the Tavily + GPT result from Step 0. When GPT successfully extracts a date from the serial number using the manufacturer-specific format documentation retrieved by Tavily, this is the highest-confidence path (up to 0.94) because the date comes directly from the device itself, with no proxy or estimation involved.

OEMs encode dates in very different ways. Some embed a two-digit year followed by a letter code representing the month. Others use a full YYYYMMDD substring, a Julian day-of-year pattern, or a product-family prefix followed by a year digit. Tavily surfaces the relevant documentation for each manufacturer at query time, and GPT applies the correct decoding logic to the specific serial number.

For cases where the encoding cannot be confirmed with high certainty, confidence is automatically capped at 0.74 and the audit notes are flagged with "Serial year decode unverified." GPT confidence is capped at 0.82 regardless of what it returns.

### Step 2 - FDA UDI Exact Match

Queries the FDA Unique Device Identification database with an exact match on `company_name` and `version_or_model_number`. Results are scored and ranked by how well they match the manufacturer and model tokens before accepting. The `publish_date` from the UDI record is used as a date proxy (noted as such in the audit trail). Confidence: 0.72 to 0.90.

### Step 3 - FDA UDI Fuzzy Match

Same database but with prefix wildcards on both fields, plus a fallback search against `brand_name`. Requires a minimum match score of 5 to avoid false positives. Confidence: 0.68 to 0.88.

### Step 4 - Model Rules + Product-Line Year

For manufacturers and models with well-known production windows (like the Hospira Plum A+, ZOLL M Series, Philips IntelliVue line, etc.), I curated a table of 37 model anchors in `src/lib/modelAnchors.ts`. Each anchor has a floor year, ceiling year, typical mid-window year, and often a specific FDA K-number. If the serial could not be decoded but the device type is known and an anchor exists, the `typicalYear` is used as an estimate (formatted as `YYYY-06-15` to clearly signal it is a mid-year estimate, not a precise date). Confidence: 0.50 to 0.68 depending on how well-defined the production window is.

### Step 5 - FDA 510(k) as Date Floor

Uses the prefetched 510(k) result from Step 0. The clearance date is used as the manufactured date with a clear note that it is a regulatory floor, not the actual build date. The device type from the 510(k) submission is also run through a re-classification step: model/manufacturer keyword rules are checked first, and if they disagree with the FDA label, GPT re-classifies it. Confidence: 0.58 to 0.82.

### Step 6 - Product-Line Year + FDA Device Type

Combines the model anchor's typical year with a UDI-sourced device type for rows where neither the serial nor the 510(k) provided a complete result. Confidence: 0.70.

### Step 7 - GPT Last Resort

If all other steps fail, GPT classifies the device type and estimates a manufacture year, constrained to the model anchor window if one exists. Confidence: 0.42 to 0.72 depending on how much context is available.

### Date Guardrails

Every date produced by any step is passed through `src/lib/dateGuardrails.ts` before the row is finalized. This clamps the date to `[floorYear, ceilingYear]` derived from the model anchor and the 510(k) floor. If the date gets adjusted, confidence is reduced and a note is appended explaining the adjustment.

One specific exception worth calling out: GE serial decodes (RTS/RT9/SA3/SPX prefix format) are ceiling-clamped only, never raised to the FDA floor. This is because the GE 510(k) clearance dates are often from the 1990s for device families that stayed in production for decades, and blindly raising a serial-decoded 2015 date to a 1990s floor would be wrong.

---

## Data Sources and Confidence Ranges

| Source | Confidence Range | Description |
|---|---|---|
| Serial decode (Tavily + GPT) | 0.74 - 0.94 | Manufacturer format docs + GPT extraction |
| FDA UDI exact match | 0.72 - 0.90 | Official FDA device database |
| FDA UDI fuzzy match | 0.68 - 0.88 | Official FDA device database |
| FDA 510(k) | 0.58 - 0.82 | Regulatory clearance floor date |
| Model reference (product-line anchor) | 0.50 - 0.68 | Curated production window |
| LLM classification | 0.42 - 0.72 | GPT fallback with anchor context |
| None | 0.0 | No source matched |

---

## Device Type Taxonomy

All device types are normalized to one of 13 fixed categories regardless of which data source produced them:

`Imaging/Radiology` | `Patient Monitoring` | `Infusion/Pump` | `Ventilator/Respiratory` | `Surgical` | `Diagnostic/Lab` | `Dialysis` | `Defibrillator/Cardiac` | `Endoscopy` | `Sterilization` | `Ultrasound` | `Other` | `Unknown`

The translation from raw FDA labels (which can be verbose, like "PATIENT DATA MODULE, PHYSIOLOGICAL MONITORING SYSTEM") to these categories happens in `src/lib/taxonomy.ts` using keyword rules, with GPT as a fallback for labels that do not match any rule.

---

## Technical Highlights

### Parallel API Calls

For every row, the 510(k) lookup and the Tavily + GPT serial decode fire simultaneously via `Promise.all`. These two tasks are completely independent and together typically take 6 to 10 seconds if both hit the network. Running them in parallel means the total time is the maximum of the two, not the sum.

At the dataset level, rows are processed 10 at a time using `p-limit` with a concurrency of 10. All 801 rows run through the pipeline in batches of 10, with a live progress bar updating after each row completes.

### Multi-Tier Caching

Four separate caching layers minimize redundant API calls:

1. **Static pre-built cache** (`public/fda-model-cache.json`) - a JSON file with 21 pre-fetched 510(k) entries for the most common manufacturer-model pairs in the dataset, built offline before the demo using `scripts/build-fda-cache.mts`. These are served as a static file and checked before any live FDA query fires.
2. **In-flight deduplication** - a `Map<url, Promise>` in `fda.ts` ensures that if two rows trigger the exact same FDA API call simultaneously, only one HTTP request is made and both rows await the same promise.
3. **Tavily localStorage cache** - Tavily web search results are persisted to `localStorage` under the key `equiply:tavily_serial_formats`. On subsequent runs, the cached context is returned instantly without hitting the Tavily API again. An in-memory Map layer sits in front of this for within-session deduplication.
4. **Row-level memoization** - `enrichRow()` uses a `Map<cacheKey, Promise<EnrichedRow>>` so identical rows (same manufacturer, model, and serial) are only enriched once per session.

### Low Token Usage

GPT is used in two places, both with tight token budgets:

- **Serial decode**: `max_tokens: 150`, `gpt-5.4-mini`. Returns a JSON object with `manufactured_date`, `confidence`, and `method`. Skipped entirely if the serial was already decoded in a prior step.
- **Device classification**: `max_tokens: 100`, `gpt-5.4-mini`. Returns `device_type`, `estimated_year`, `confidence`, and `reasoning`. Only called as a last resort after all deterministic sources have been exhausted.

Both calls use OpenAI's structured output mode (`response_format: json_schema, strict: true`), which eliminates any JSON parsing failures and ensures the model stays within the defined schema. GPT is never called if the API key is missing or not configured.

I ran the full 801-row dataset once using the OpenAI API key provided by Juan, so you can check the token usage in the account dashboard.

### Smart Conflict Resolution

When the FDA database returns a device type label that conflicts with what the manufacturer-and-model keyword rules say, the FDA label is rejected in favor of the rule. For example, if FDA UDI returns "PATIENT DATA MODULE" for a ZOLL defibrillator, the rule that maps ZOLL to "Defibrillator/Cardiac" takes priority. This prevents FDA labeling artifacts from contaminating the output.

---

## Application Features

**CSV Upload** - drag-and-drop or file picker. Handles the `serial number` column name with a space (as in the challenge dataset) by normalizing headers on parse.

**Enrichment Table** - sorted ascending by manufactured date as required. Filterable by confidence tier (high/medium/low), device type, and free-text search across manufacturer, model, and serial. Rows animate with a pulse skeleton while enrichment is in progress. Each row has an info tooltip showing the full audit trail with clickable FDA K-number links.

**Stats Bar** - shows total device count, a segmented enrichment quality bar (green = high confidence, blue = medium, amber = low), and the fleet date span (oldest to newest year).

**Device Type Distribution** - donut chart with a mini progress-bar legend showing the percentage breakdown of each device type category.

**Fleet Age Distribution** - bar chart showing device count by manufacture year, giving a visual picture of fleet age.

**CSV Export** - exports the enriched dataset sorted by manufactured date, containing the original columns plus `manufactured_date` and `device_type`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 (with Rolldown bundler) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| CSV parsing | PapaParse |
| Concurrency | p-limit |
| LLM | OpenAI gpt-5.4-mini |
| Web search | Tavily Search API |
| Medical device data | openFDA UDI + 510(k) APIs |

---

## Project Structure

```
src/
  lib/
    enrichRow.ts          - Main 8-step pipeline, row memoization
    serialParse.ts        - Serial date extraction and validation logic
    fda.ts                - openFDA UDI and 510(k) queries with scoring
    fdaCache.ts           - Static cache loader for pre-built 510(k) data
    llm.ts                - GPT serial decode and device classification
    tavily.ts             - Web search with 3-tier caching
    modelAnchors.ts       - 37 curated production window anchors
    dateGuardrails.ts     - Date clamping, GE exception, unverified cap
    deviceRules.ts        - Keyword rules for device type by mfr/model
    taxonomy.ts           - FDA label to 13-category normalizer
  components/
    Uploader.tsx          - Drag-and-drop CSV upload
    EnrichmentTable.tsx   - Filterable, sortable results table
    DeviceTypePie.tsx     - Donut chart + fleet age bar chart
    StatsBar.tsx          - KPI tiles and quality bar
    ExportButton.tsx      - CSV download
    NotesTooltip.tsx      - Audit trail tooltip with K-number links
  hooks/
    useEnrichment.ts      - p-limit concurrency runner, progress dispatch

scripts/
  build-fda-cache.mts     - Pre-fetches 510(k) data for challenge dataset
  batch-enrich-stats.mts  - Full-dataset enrichment stats and coverage report
  analyze-csv-gaps.mts    - Identifies manufacturer-model pairs with no coverage
  audit-serial-spec.mts   - Per-OEM serial decoder validation
  spot-serial.mts         - Quick single-serial test tool

public/
  fda-model-cache.json                  - Pre-built 510(k) cache (21 entries)
  hackathon-data/challenge_data-v1.csv  - Original challenge dataset
  architecture.html                     - Visual pipeline explainer
```

---

## API Keys

The application uses three external APIs. Keys go in a `.env` file at the project root:

```
VITE_OPENAI_API_KEY=...
VITE_TAVILY_API_KEY=...
VITE_FDA_API_KEY=...    # optional - a public fallback key is included
```

The app degrades gracefully if keys are missing: Tavily and GPT are skipped, and the pipeline falls back to FDA UDI/510(k) and model anchors, which still cover the majority of the dataset.

---

## Output

The enriched CSV contains the original three columns plus:

| Column | Description |
|---|---|
| `manufactured_date` | ISO 8601 date (YYYY-MM-DD). Day is set to 15 and/or month to 06 when only year or year-month precision is known, making it clear the date is an estimate rather than a precise value. |
| `device_type` | One of 13 standardized categories. |

[Download the enriched output here](https://drive.google.com/file/d/1X3NJWGhNEGVAh2e2eT7NAirZ_aeC7fvD/view?usp=sharing)

---

## About Me

I have a solid foundation in both frontend and backend development. You can find more about my background on [my resume](https://www.daivyashah.com/assets/Daivya_Shah_Resume.pdf).
