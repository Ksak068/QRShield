# QR_Shield Enterprise

**Intelligent QR-Code Phishing Detection System — ML + LLM + URL Reputation Analysis for Corporate Environments.**

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | Full-stack framework — pages, API routes, server actions |
| **React 19** | UI library |
| **TypeScript** | Type safety across entire codebase |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** | Radix-based UI primitives — all owned as source files |
| **Framer Motion** | Page transitions, micro-interactions |
| **Lucide React** | Icons |
| **Recharts** | Pie, Bar, Line charts for analytics |
| **next-themes** | Dark/light/system theme toggle |

### Backend (all Next.js)

| Technology | Purpose |
|---|---|
| **Next.js Route Handlers** | REST API endpoints (`/api/*`) |
| **Next.js Server Actions** | Server-side mutations |
| **Next.js Middleware** | Route protection + role-based access |
| **Auth.js v5** (next-auth beta) | JWT sessions, Credentials provider, Prisma adapter |
| **Zod** | Input validation on all mutations |
| **Web API `fetch`** | All external HTTP calls — no Node.js `http`/`https` |
| **Web API `btoa`/`TextEncoder`** | Base64 — no Node.js `Buffer` |
| **Web API `crypto.randomUUID`** | ID generation — no Node.js `crypto` |

### Database

| Technology | Purpose |
|---|---|
| **PostgreSQL (Neon)** | Serverless PostgreSQL, Vercel-native |
| **Prisma ORM** | Type-safe client, schema, migrations |

### QR Processing

| Technology | Purpose |
|---|---|
| **jsQR** | QR decoding from ImageData |
| **html5-qrcode** | Camera + file-based QR scanning |

### Machine Learning

| Technology | Purpose |
|---|---|
| **scikit-learn** (offline) | Random Forest training (`ml/train.py`) |
| **ml-random-forest** | In-browser inference from exported JSON |
| **Heuristic fallback** | Feature-based scoring when model not loaded |

### Threat Intelligence

| Signal | Method | Auth Required | Weight |
|--------|--------|:---:|:---:|
| **Random Forest** | 100-tree model exported from sklearn | None | 35% |
| **GPT Classifier** | OpenRouter API (`openai/gpt-oss-120b:free` → fallback `openai/gpt-oss-20b:free` → heuristic) | OpenRouter key | 35% |
| **VirusTotal** | URL submission + analysis via v3 API | VT API key | 20% |
| **Local Reputation** | Typosquatting, shorteners, high-risk TLDs, path analysis | None | 5% |
| **Domain Age** | Whois-based age scoring | None | 5% |

### Security

| Layer | Implementation |
|---|---|
| Rate Limiting | PostgreSQL-backed sliding window (scan: 10/min, auth: 5/min) |
| CSRF | Auth.js built-in |
| Input Validation | Zod on all routes |
| XSS Prevention | TypeScript strict + React escaping |
| SQL Injection | Prisma parameterized queries |
| Secure Cookies | Auth.js httpOnly, sameSite, secure |
| API Key Protection | Server-only env vars |
| Middleware Guards | Protected routes + admin role check |

---

## Architecture

### Route Structure

```
/                  Landing page
/login             Authentication
/register          User registration
/forgot-password   Password reset
/verify-email      Email verification
/dashboard         Analytics overview
/scanner           QR code scanner
/history           Scan history
/reports           PDF report generation
/admin             User management + system analytics
/settings          API keys, theme, profile
```

### URL Analysis Pipeline

```
QR Code Decoded
     ↓
URL Extracted
     ↓
Feature Extraction (8 features)
     ↓
┌─────────────────────────────────────────────┐
│            Three Independent Signals          │
│                                               │
│  Random Forest  ───   GPT Classifier  ───  VT│
│  (35% weight)       (35% weight)       (20%) │
│                                               │
│  + Local Reputation (5%) + Domain Age (5%)   │
└──────────────────────┬──────────────────────┘
                       ↓
              Risk Engine (weighted)
                       ↓
              Result (score 0–100,
              classification, AI explanation)
```

**Step-by-step:**
1. QR decoded → URL extracted
2. 8 features extracted (domain length, subdomains, HTTPS, entropy, special chars, IP, keywords, redirects)
3. Random Forest predicts phishing probability from the trained 100-tree model
4. GPT classifier independently analyzes the URL via OpenRouter (primary `gpt-oss-120b:free`, fallback `gpt-oss-20b:free`, ultimate heuristic)
5. VirusTotal looks up URL in community detection database (optional, skipped without key)
6. Local reputation checker detects typosquatting, shorteners, high-risk TLDs, suspicious paths (no API needed)
7. Risk engine combines all signals with weighted scoring
8. AI explanation generated from GPT response
9. Full result stored in PostgreSQL and returned to client

### When APIs Are Missing

The system degrades gracefully with no API keys configured:
- **No OpenRouter key** → heuristic GPT fallback (feature-based scoring identical to RF fallback)
- **No VirusTotal key** → signal skipped (0 contribution, remaining signals rebalanced)
- **Safe Browsing** → always active (100% local, zero dependencies)
- **Random Forest** → always active (model bundled in `public/models/rf-model.json`)
- **Heuristic fallback** → if model fetch fails, feature-based scoring kicks in

### Folder Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             #   Login, register, forgot-password, verify-email
│   ├── (dashboard)/        #   Dashboard, scanner, history, reports, admin, settings
│   └── api/                #   Route handlers (scan, auth, admin, settings, health)
├── actions/                # Server Actions (auth, scan)
├── components/
│   ├── ui/                 # shadcn-style primitives
│   ├── layout/             # Navbar, sidebar, footer, theme
│   ├── charts/             # Recharts wrappers
│   ├── scanner/            # QR scanner component
│   └── shared/             # StatCard, skeleton loaders
├── hooks/                  # use-scanner, use-debounce, use-media-query
├── lib/                    # auth.ts, prisma.ts, rate-limit.ts, utils.ts
├── services/               # QR decode, feature extraction, RF, GPT, VT, SB, risk engine
├── types/                  # TypeScript definitions
├── validations/            # Zod schemas
└── middleware.ts           # Route protection + admin guard
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (uses v25.0.0)
- npm
- PostgreSQL database (Neon recommended)

### Installation

```powershell
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

### Environment Variables (`.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | Neon PostgreSQL connection string |
| `AUTH_SECRET` | **Yes** | — | Generate with `npx auth secret` |
| `AUTH_URL` | No | `http://localhost:3000` | Deployment URL |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key (enables GPT classification) |
| `OPENROUTER_PRIMARY_MODEL` | No | `openai/gpt-oss-120b:free` | Primary GPT model |
| `OPENROUTER_FALLBACK_MODEL` | No | `openai/gpt-oss-20b:free` | Fallback if primary fails |
| `VIRUSTOTAL_API_KEY` | No | — | VirusTotal v3 API key |

### Default Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@qrshield.com` | `Admin@123456` |
| Corporate User | `user@qrshield.com` | `User@123456` |

---

## ML Model Training

Train the Random Forest model offline (requires Python + scikit-learn):

```powershell
pip install scikit-learn numpy
python ml/train.py
```

Output: `public/models/rf-model.json` — a 100-tree Random Forest exported as JSON for in-app inference via `ml-random-forest`.

A pre-trained model is already bundled at `public/models/rf-model.json` (86.4% accuracy on synthetic data). Retrain with real URL datasets for production use.

---

## Deployment

Optimized for **Vercel**:

1. Push to GitHub
2. Import to Vercel
3. Set environment variables in Vercel dashboard
4. Set build command: `npx prisma generate && next build`
5. After deploy, run seed script against Neon DB: `npx tsx prisma/seed.ts`

### Vercel Build Command

```
npx prisma generate && next build
```

### Notes

- `next.config.ts` uses `transpilePackages: ["lucide-react", "framer-motion"]` — required because `lucide-react` v0.400.0 lacks `"use client"` directives needed by Next.js 16's bundler.

---

## License

MIT — For educational and research purposes.
