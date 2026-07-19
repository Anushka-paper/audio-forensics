# 🕵️ Voice Enhancement and Automated Report Generation for Audio Forensic Analysis

**Voice Enhancement and Automated Report Generation for Audio Forensic Analysis** is a full-stack, offline-first web application designed for forensic examiners and investigating officers. It provides an all-in-one dashboard to securely analyze, enhance, and transcribe evidentiary audio files while maintaining strict chain-of-custody protocols.

## ✨ Key Features

- 🔒 **Secure by Default**: All uploaded evidence is instantly hashed (SHA-256) and encrypted at rest using AES-256. Decryption only happens in-memory during playback or processing.
- 🎙️ **Multi-Model Deepfake Detection**: Uses a simulated ensemble of models (AASIST, RawNet2, Spectral-ZCR) to calculate a unified authenticity score and flag AI-generated audio or spliced edits.
- 🔊 **Audio Enhancement**: Processes audio using FFmpeg to generate a non-destructive "Forensic Mode" (for evidence preservation) or a "Cosmetic Mode" (noise reduction for human listening).
- 📝 **Diarized Transcription**: Automatically detects silence/speaker boundaries and generates timestamped transcripts. (Includes translation fallback capabilities).
- 🌍 **Environmental Acoustics Profiling**: Analyzes the noise floor to mathematically estimate the recording environment (e.g., Indoor/Office vs. Traffic) and extracts ambient event tags.
- 🔗 **Cross-File Consistency**: Automatically cross-references the acoustic fingerprints (ENF phase and noise floor) of new uploads against the entire database, immediately alerting investigators to linked cases.
- 📜 **Chain of Custody & Reporting**: Automatically logs every action (upload, processing, encryption) with a timestamp. Forensic reports can be exported to JSON or printed to PDF directly from the dashboard.

---

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, WaveSurfer.js
- **Backend**: Python, FastAPI, SQLite (SQLAlchemy), BackgroundTasks
- **Audio Processing**: FFmpeg, pydub, SpeechRecognition, librosa (simulated)
- **Security**: cryptography (Fernet AES-256), hashlib

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- FFmpeg installed and added to your system PATH.

### Quick Start (Windows)
We have provided a convenient batch script that will start both the frontend and backend servers automatically:
```bash
.\start_demo.bat
```
*(This will open the dashboard in your default web browser at `http://localhost:5173`)*

### Manual Start

**1. Start the Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## ☁️ How to Deploy (Free Tier)

This application is designed to be easily deployable on free hosting tiers (Render + Vercel).

### 1. Deploy the Backend to Render.com
1. Create a **Web Service** on Render linked to your GitHub repository.
2. Under "Language" or "Environment", select **Docker**.
3. Set the **Root Directory** to `backend`.
4. Render will automatically detect the `Dockerfile` inside the `backend` folder and build it (this includes FFmpeg and Python).
5. Once deployed, copy your live backend URL (e.g., `https://baft-backend.onrender.com`).

### 2. Deploy the Frontend to Vercel
1. Import your GitHub repository to Vercel.
2. Set the Root Directory to `frontend`.
3. Add an Environment Variable: `VITE_API_URL` = `https://baft-backend.onrender.com` (Your Render URL).
4. Deploy! 

---

## 📁 Project Structure

```text
Audio-forensic/
├── backend/
│   ├── main.py              # FastAPI server & endpoints
│   ├── models.py            # SQLite Database schemas
│   ├── security.py          # AES-256 Encryption logic
│   ├── worker.py            # Background task coordinator
│   └── ml_pipeline/         # Core audio processing & simulated ML scripts
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React Dashboard UI
│   │   ├── App.css          # Tailwind & custom styling
│   │   └── main.tsx         # React entry point
├── start_demo.bat           # Quickstart script for local testing
└── README.md                # Project documentation
```

---
*Disclaimer: Certain ML features (like Environmental Classification and Speaker Verification) utilize heuristic simulations designed for lightweight MVP demonstration purposes and fast local execution.*