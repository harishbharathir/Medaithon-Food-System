# 🍽️ Medaithon Realtime Food Distribution System (React + Vite + WebSockets)

A modern, high-concurrency, real-time food logistics and meal distribution web application built for **Medaithon 2026** using **React 19, Vite, Tailwind CSS v4, Express, Socket.IO, and SQLite (WAL Mode)**.

Designed specifically to eliminate DOM thrashing and frontend bottlenecks during high-throughput event meal rushes (thousands of scans across multiple counters simultaneously).

---

## ⚡ Why React + Vite Eliminates Bottlenecks

1. **Virtual DOM Reconciliation**: Instead of manual DOM manipulation (`innerHTML`), React only re-renders the specific counter number or new feed item that changed.
2. **Batching & 60 FPS Smoothness**: React batches high-frequency WebSocket updates from multiple counters so the volunteer scanner and live dashboard never lag or freeze.
3. **Centralized Reactive State (`FoodSystemContext`)**: A single reactive context connects Counter 1, Counter 2, the Live Dashboard, and the Admin portal, guaranteeing cross-device sync with zero latency.
4. **Clean Component Architecture**:
   - `ScannerView`: Camera barcode scanning (`html5-qrcode`) + USB handheld gun support + cooldown debounce + instant duplicate blocking.
   - `LiveDashboard`: High-impact dining hall projector display with real-time claims stream, Chart.js hourly velocity graph, and full-screen mode.
   - `AdminPanel`: Live quota updater, session name updater, session switcher, Add Manual Walk-in Entry form, CSV report exporter.
   - `BadgesView`: Printable participant badges with Code128 barcodes rendered via `JsBarcode`.

---

## 🚀 Quick Start Guide

### 1. Start the Production Server
```bash
npm start
```
Starts the full-stack server on **`http://localhost:3000`** serving the compiled React frontend, REST endpoints, and WebSockets.

### 2. Development Mode (with Hot Module Replacement)
```bash
npm run dev
```
Runs both the backend API server (`port 3000`) and Vite HMR frontend (`port 5173`) concurrently.

---

## 🌐 Application Navigation & Live URLs

Open **[http://localhost:3000](http://localhost:3000)** in your browser:

- 📷 **Volunteer Scanner**: Select **Counter 1**, **Counter 2**, or custom counters. Auto-detects IDs via camera, barcode gun, or typing.
- 📊 **Live Dashboard**: Big-screen monitor displaying Total Quota, Claimed count, Remaining count, Veg/Non-Veg breakdown, and live claim feed.
- ⚙️ **Admin Portal**: Change meal names and target quota live; register walk-in participants not listed in the DB; download CSV reports.
- 🏷️ **ID Badges**: View and print participant ID badges with scannable Code128 barcodes.

> **Smartphone Scanner over Wi-Fi**: Open `http://<your-ip>:3000` (e.g. `http://192.168.0.132:3000`) on any phone on the local venue Wi-Fi to use the phone's camera directly as a barcode scanner!

---

## 🧪 Testing Real-Time Meal Claims in 10 Seconds

1. Open **[http://localhost:3000](http://localhost:3000)**.
2. Go to the **"Volunteer Scanner"** tab.
3. Click any instant test pill like `MED-1001` (or scan any barcode):
   - Scanner plays a success chime, triggers confetti, and claims the meal instantly without pressing any button.
   - The Live Dashboard updates **simultaneously** in real-time!
