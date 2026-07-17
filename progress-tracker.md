# BAFT (Bharat Audio Forensics Toolkit) Progress Tracker

## Phase 1: MVP Setup & Pipeline Core
- [x] Initialize repository structure (`backend/`, `frontend/`, `ml_pipeline/`)
- [x] Switch to SQLite (Removed Docker/PostgreSQL/Redis for local execution)
- [x] **Backend (FastAPI)**
  - [x] Set up basic app structure and database connection
  - [x] Create Database Models (Case, File, Transcript, Log)
  - [x] Implement secure file upload and SHA-256 hashing
  - [x] Set up FastAPI BackgroundTasks for ML pipeline processing
- [x] **Frontend (React/Vite)**
  - [x] Initialize Vite + React + Tailwind project
  - [x] Build layout and navigation
  - [x] Build upload evidence interface
  - [x] Integrate Wavesurfer.js for audio visualization
  - [x] Build transcript viewer UI
- [x] **ML Pipeline Core**
  - [x] Audio preprocessing (FFmpeg resample to 16kHz mono)
  - [x] Enhancement module integration (DeepFilterNet)
  - [x] Diarization module integration (pyannote)
  - [x] ASR module integration (IndicConformer or Whisper)
- [x] **Reporting**
  - [x] Implement chain-of-custody audit log
  - [x] Generate JSON/PDF reports

## Phase 2: Authenticity & Translation (v1.1)
- [x] Implement Authenticity module (AASIST / Deepfake detection)
- [x] Implement Splice point detection / ENF analysis
- [x] Translation layer (IndicTrans2)
- [x] Advanced case management UI

## Phase 3: Advanced Features (v2.0)
- [x] Speaker verification (Reference sample matching)
- [x] Batch processing capabilities
- [x] ENF historical database cross-check
