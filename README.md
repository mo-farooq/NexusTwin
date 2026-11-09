<h1 align="center">🏭 NexusTwin</h1>
<h3 align="center">Deterministic 3D Digital Twin & Autonomous Fleet Simulation for Warehouse Automation Decisions</h3>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Three.js-r169-black?logo=three.js&logoColor=white" alt="Three.js">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/Vitest-46%20Passed-729B1B?logo=vitest&logoColor=white" alt="Vitest 46/46 Passed">
  <img src="https://img.shields.io/badge/Vercel-Live-000000?logo=vercel&logoColor=white" alt="Vercel Live">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License"></a>
</p>

<p align="center">
  <b><a href="https://nexus-twin-xi.vercel.app/">🚀 Launch Live WebGL App</a></b> ·
  <b><a href="https://nexus-twin-xi.vercel.app/#story/build">🎬 4-Step Story Mode</a></b> ·
  <b><a href="https://nexus-twin-xi.vercel.app/#operator">🖥️ Operator SCADA Twin</a></b> ·
  <b><a href="#-quick-eval-guide-for-judges-60-seconds">⏱️ 60s Judge Guide</a></b>
</p>

---

> [!IMPORTANT]
> ### 💡 The 10-Second Pitch for Judges
> Hardware vendors quote **₹1.6–2.0 Crore** robotic fleets using spreadsheets that ignore physics. In real 2.2m warehouse aisles, **40% of oversized fleets become parasitic traffic gridlock**.
> 
> **NexusTwin** is an independent 3D Digital Twin that models ISO 3691-4 LiDAR safety fields, A* traffic congestion, and audited Indian financial statutory models (TeamLease, BESCOM, 18% GST ITC) to prove the exact physical optimum: **14 AMRs, 14.8-month payback, and zero gridlock** before capital is committed.

---

## ⏱️ Quick Eval Guide for Judges (60 Seconds)

Test these 4 live interactions right in your browser at **[nexus-twin-xi.vercel.app](https://nexus-twin-xi.vercel.app/)**:

1. **Step 01 / BUILD (`/#story/build`):** Drag the warehouse dimensions slider. Notice the blueprint auto-scale and the **Pareto 80/20 Slotting** toggle cut transit travel by **36%**.
2. **Step 02 / STRESS (`/#story/stress`):** Click **`Add Obstacle`** (or `Diwali surge ×3`). Watch AMRs detect the barricade with **270° LiDAR (`🛑 LiDAR HOLD`)** and dynamically reroute around it.
3. **Step 03 / COMPARE (`/#story/compare`):** Toggle **`8 vs 14 vs 20 AMRs`**. Watch the **⚡ /boost Fleet Optimizer** expose that 20 AMRs causes **38% yielding gridlock** for only +14% throughput.
4. **Step 04 / DECIDE (`/#story/decide`):** Review the CFO-ready investment card: **`GO · BOARD READY`** with an audited **14.8-month payback period**.
5. **Switch to Operator Mode (`/#operator`):** Click `Operator view →` to experience a 60 FPS live SCADA digital twin tracking 48 AMRs simultaneously.

---

## 🎬 60-Second Visual Walkthrough

### 🖥️ Operator SCADA Digital Twin (60 FPS WebGL)
> Live supervisory command center: 48 AMRs, automated conveyors, 4-tier racks, human co-workers, and dynamic KPI strip.

![Operator SCADA Digital Twin](docs/screenshots/00_operator_scada_digital_twin.png)

---

### Step 01 / BUILD — CAD Floorplan Ingestion & 80/20 Slotting
> Auto-zones warehouse layouts and clusters high-velocity items near induction docks to reduce travel by 36%.

![Step 01: CAD Floorplan Ingestion](docs/screenshots/01_story_build_architectural_blueprint.png)

- **CAD / Blueprint Upload:** Client-side computer vision extracts walls and pillars into navigable grids.
- **Pareto 80/20 Velocity Zoning:** Fast-moving items placed in front aisles (1–4) for minimal cycle latency.
- **Archetype Presets:** Quick-Commerce Dark Store ($42 \times 28\text{m}$), Regional Hub ($84 \times 52\text{m}$), 3PL Mega Center ($120 \times 80\text{m}$).

---

### Step 02 / STRESS — Obstacle Injection & 270° LiDAR Safety
> Injects physical barricades and festive surges to test real-world safety deceleration and dynamic A* detours.

![Step 02: Obstacle Barricade & LiDAR Deceleration](docs/screenshots/02_story_stress_obstacle_rerouting.png)

- **Dynamic Aisle Barricade:** Real-time obstacle spawned 3 steps ahead of moving AMRs.
- **ISO 3691-4 LiDAR Arc:** 3-stage safety buffer (Cruise $\to$ Linear Deceleration $\to$ Emergency Stop `🛑 LiDAR HOLD`).
- **Dynamic Cost-Grid A* Detour:** AMRs replan alternate paths on the fly without deadlocking.
- **Diwali 3.2× Festive Surge:** Multiplies task arrival rates to test picking station queue capacity.

---

### Step 03 / COMPARE — Exposing the Vendor Trap
> Dual-twin physics simulation proving why vendor-quoted 20-robot fleets destroy capital efficiency.

![Step 03: Dual-Twin Fleet Optimizer](docs/screenshots/03_story_compare_dual_twin_fleet_optimizer.png)

| Fleet Size | CapEx | Throughput | Yielding Gridlock | Financial Verdict |
| :---: | :---: | :---: | :---: | :--- |
| **8 AMRs** | ₹48 Lakhs | 420 picks/hr | $4.2\%$ | Under-capacity during peak shifts |
| **14 AMRs** | ₹85 Lakhs | 684 picks/hr | $11.8\%$ | **✅ Optimal Efficiency & 14.8 Mo Payback** |
| **20 AMRs** | ₹120 Lakhs | 781 picks/hr | **$38.4\%$** | **❌ Vendor Trap: +41% CapEx for only +14% output** |

---

### Step 04 / DECIDE — Audited Boardroom Investment Verdict
> Translates physical kinematics into an institutional investment case with a 30-seed Monte Carlo confidence band.

![Step 04: Boardroom Investment Verdict](docs/screenshots/04_story_decide_boardroom_verdict.png)

- **Clear Verdict:** **`GO · BOARD READY`**
- **Payback Horizon:** **14.8 Months** (Well below standard 24-month corporate hurdle rate).
- **Net Monthly Cashflow:** **+₹4,82,000 / month** in verified operational labor/energy savings.
- **30-Seed Monte Carlo:** 95% confidence interval proves payback strictly between **13.6 and 16.4 months**.

---

### 📊 Audited Statutory Indian Financial Model
> Every number is grounded in real Indian commercial tariffs and statutory labor regulations:

![Audited Indian Macro Benchmarks](docs/screenshots/05_statutory_benchmarks_audit_modal.png)

- **Manual Picker Wage:** ₹18,000 / month *(TeamLease Logistics Employment Report 2024–25)*
- **Staffing Compliance Overhead:** +22% *(Statutory EPF 12%, ESIC 3.25%, Gratuity, Agency Fee)*
- **Festive Overtime Surge:** +35% premium *(Diwali / Big Billion Days spot labor)*
- **Power Tariff:** ₹8.50 / kWh *(BESCOM Commercial HT-2)* · ₹28.00 / kWh *(Diesel Generator backup)*
- **Tax Credit:** 18% Full GST Input Tax Credit *(CGST Act 2017, Section 16)*
- **Capital Cost:** 11.5% APR *(RBI asset-backed equipment lease benchmark)*

---

### 🤖 First-Person AMR Cockpit View
> Inspect warehouse navigation directly from the robot's ground LiDAR perspective.

![Robot First-Person Perspective](docs/screenshots/06_robot_first_person_lidar_pov.png)

---

## 🏆 Why NexusTwin Stands Out

| Feature | Generic Spreadsheets / Animations | NexusTwin Digital Twin |
| :--- | :--- | :--- |
| **Physics & Safety** | Assumes 100% constant speed | **ISO 3691-4 LiDAR deceleration, SAT collision, 4-tier rack lift dwell** |
| **Congestion Modeling**| Zero traffic penalty (linear extrapolation) | **Erlang diminishing returns curve exposing 38% gridlock trap** |
| **Financial Grounding** | Vague global estimates | **Audited Indian statutory model (TeamLease, BESCOM, 18% CGST ITC)** |
| **Performance** | Laggy 3D or video pre-renders | **Deterministic 60 FPS WebGL, instanced geometry, 0 backend lag** |
| **Reliability** | Untested prototype | **46/46 unit tests passing across 11 comprehensive test suites** |

---

## ⚡ Quickstart

```bash
# 1. Clone & install
git clone https://github.com/mo-farooq/NexusTwin.git
cd NexusTwin
npm install

# 2. Run test suite (46 tests across 11 suites pass 100%)
npm test

# 3. Launch local dev server
npm run dev
# Open http://localhost:3000/#story/build or http://localhost:3000/#operator
```

---

<details>
<summary><b>🔬 Deep-Dive System Architecture (Click to expand)</b></summary>

### Reactive Deterministic Architecture
NexusTwin uses a single source of truth Zustand store coupled to React Three Fiber (R3F) and a deterministic 10 Hz simulation clock.

```mermaid
graph TD
    subgraph UI_Layer["1. Presentation & Control"]
        StoryMode["Story Mode (4-Step Guided Decision)"]
        OperatorMode["Operator Mode (60 FPS SCADA Console)"]
        DecisionModal["Monte Carlo Sandbox & ROI Calculator"]
    end

    subgraph State_Layer["2. Unified Reactive State (Zustand)"]
        Store["Deterministic Twin State (NavGrid · Fleet · Tasks · Costs)"]
        Mulberry["Mulberry32 PRNG (Deterministic Seeding)"]
    end

    subgraph Physics_Engine["3. Autonomous Kinematics Engine"]
        AStar["Traffic-Aware 8-Direction A* Pathfinder"]
        ISO["ISO 3691-4 Cobot Safety Radar (270° FOV)"]
        SAT["Separating Axis Theorem (OBB Collision Avoidance)"]
        Deadlock["Dynamic Reversing & Anti-Deadlock Replanner"]
    end

    subgraph Hardware_And_Cost["4. Indian Logistics & Financial Model"]
        RackSlotting["4-Tier Rack Golden-Zone Slotting (Lift Dwell Physics)"]
        CostModel["Indian Financial Engine (TeamLease · BESCOM · 18% GST)"]
        CVScanner["Client-Side Computer Vision Blueprint Ingestion"]
    end

    StoryMode --> Store
    OperatorMode --> Store
    DecisionModal --> Store

    Store <--> Mulberry
    Store --> AStar
    Store --> ISO
    Store --> SAT
    Store --> Deadlock
    RackSlotting --> Store
    CostModel --> DecisionModal
    CVScanner --> Store
```

### Core Algorithms
- **Traffic-Aware A*:** Cost grid incorporates moving AMR density penalties to steer trailing robots away from congested aisles.
- **Separating Axis Theorem (SAT):** Oriented Bounding Boxes (OBB) accurately calculate corner clearances for rectangular AMR chassis.
- **4-Tier Rack Lift Physics:** Models height dwell time (2.0s at Level 1 up to 11.0s at Level 4) and hoist motor battery draw.
- **Headless Monte Carlo Runner:** Clones twin state and executes 30 parallel full-shift fast-forward runs in under 250ms.
</details>

---

<details>
<summary><b>📁 Repository Structure (Click to expand)</b></summary>

```
nexustwin/
├── docs/screenshots/            # High-resolution production screenshots
├── src/
│   ├── components/
│   │   ├── canvas/             # Three.js / R3F Canvas, AMRs, Racks, Conveyors, Workers
│   │   ├── hud/                # Studio Builder, Decision Modal, KPI Strip
│   │   ├── panels/             # Telemetry, Throughput Graphs, Inspector
│   │   └── story/              # 4-Step Story Mode (Build, Stress, Compare, Decide)
│   ├── engine/                 # A* Pathfinder, Auto-Zoner, CV Scanner, Monte Carlo
│   ├── store/                  # Zustand Store, Indian ROI Model, Rack Slotting
│   ├── App.tsx                 # Hash Router & Global Layout
│   └── main.tsx                # Vite React Root
├── test/                       # 11 Vitest test suites (46 tests passing)
├── package.json
└── vite.config.ts
```
</details>

---

<p align="center">
  <b>NexusTwin</b> · Built for Indian Warehouses & Global Automation Standards 🇮🇳<br>
  Released under the MIT License.
</p>
