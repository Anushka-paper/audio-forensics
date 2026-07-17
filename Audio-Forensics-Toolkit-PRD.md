# PRD: Bharat Audio Forensics Toolkit (BAFT)
**An offline-first audio enhancement, transcription & authenticity-verification toolkit for Indian law-enforcement investigations**

Version: 1.0 (MVP Complete) · Owner: TBD · Status: Active

---

## 1. Executive Summary

**Problem Statement**
Police cyber cells and forensic labs in India routinely receive low-quality audio evidence (phone taps, WhatsApp voice notes, CCTV audio, call recordings) that is noisy, in Hindi/regional-language + English code-mixed speech, and of uncertain authenticity. Existing tools are either expensive proprietary forensic suites (Nuance, Cognitec-style, DSS) with no Indian-language support, or scattered open-source point tools (Audacity, Sonic Visualiser, Praat) with no unified, chain-of-custody-aware workflow.

**Proposed Solution**
A modular, hybrid (local-first + optional cloud) toolkit that ingests raw audio evidence and produces: (a) an enhanced, intelligible version of the audio, (b) a timestamped, speaker-diarized transcript in the original Indian language + English translation, and (c) an authenticity/tamper report (splice detection, ENF analysis, deepfake/spoof score) — all wrapped in a court-defensible, hash-verified evidence package.

**Success Criteria**
- Enhancement improves ASR Word Error Rate (WER) on noisy test clips by ≥ 20% relative vs. unenhanced baseline.
- Transcription achieves ≤ 25% WER on Hindi/code-mixed test sets (vs. ~40-60% for generic Whisper on the same data).
- Tamper/deepfake module achieves EER ≤ 10% on ASVspoof2019-LA / In-the-Wild style benchmarks.
- 100% of processing runs produce a SHA-256-hashed, timestamped audit trail (chain of custody) with zero silent failures.
- An investigator with no ML background can go from raw file → full report in ≤ 3 clicks / one CLI command.

---

## 2. User Experience & Functionality

### User Personas
1. **Investigating Officer (primary)** — uploads evidence, wants a readable transcript + a plain-language verdict ("likely authentic / signs of tampering"). Not a technologist.
2. **Forensic Examiner / Expert Witness** — needs full technical detail (spectrograms, ENF plots, confidence scores, model versions) to defend findings in court.
3. **Cyber Cell Analyst** — batch-processes many files, needs case management, search across transcripts, and export to standard report formats.

### User Stories & Acceptance Criteria

**Story 1** — *As an investigating officer, I want to drop in a noisy call recording and get a cleaner playable version, so that I can actually understand what was said.*
- AC: Accepts WAV/MP3/M4A/AAC/OGG/AMR (common Indian call-recorder formats).
- AC: Output includes before/after waveform + spectrogram comparison.
- AC: Original file is never overwritten; enhancement is always a derived artifact with a hash link back to the original.

**Story 2** — *As an analyst, I want a diarized, timestamped transcript in Hindi/regional script plus English translation, so that I can search and quote exact statements.*
- AC: Each transcript line has speaker ID, start/end timestamp, source-language text, and English translation.
- AC: Code-mixed speech (Hindi-English, Tanglish, etc.) is transcribed without forcing a single-language decode.
- AC: Confidence score per segment; low-confidence segments flagged for manual review.

**Story 3** — *As a forensic examiner, I want an authenticity report, so that I can state in court whether the audio shows signs of editing or AI generation.*
- AC: Report includes splice-point detection, Electrical Network Frequency (ENF) consistency check (where mains-hum is present), compression/re-encoding artifact detection, and a deepfake/synthetic-speech probability score.
- AC: Every claim in the report cites the method/model used and its known false-positive rate — no black-box "99% authentic" claims.

**Story 4** — *As any user, I want a case file that preserves chain of custody, so that the evidence remains admissible.*
- AC: Every file gets a SHA-256 hash on ingest; all derived artifacts reference the original hash.
- AC: Full audit log (who ran what, when, with which model/version) exportable as PDF/JSON.

### Non-Goals (v1)
- Real-time/live call interception or wiretap capture (this is a post-hoc analysis tool, not a surveillance tool).
- Full speaker identification against a biometric database (only diarization — "Speaker 1 vs Speaker 2" — not "this is Mr. X"). Speaker *verification* against a known reference sample is a v2 stretch goal, with strict access control.
- Video forensics (out of scope; audio-only for v1, even for video-container inputs — audio track is extracted and video is discarded).
- Mobile app (v1 is desktop/on-prem server only, given evidence-handling constraints).

---

## 3. AI System Requirements

### 3.1 Pipeline Architecture (data flow)

```
Raw Evidence File
   │
   ▼
[Ingest & Hash] ──► SHA-256, metadata extraction (exiftool/mediainfo), format validation
   │
   ▼
[Preprocessing] ──► resample to 16kHz mono, VAD (voice activity detection), format normalization
   │
   ├──► [Enhancement Branch] ──► denoise → dereverberation → bandwidth extension → normalized output
   │
   ├──► [Transcription Branch] ──► diarization → ASR (per-language) → translation → transcript JSON
   │
   └──► [Authenticity Branch] ──► spectral/ENF analysis → splice detection → deepfake/spoof scoring
   │
   ▼
[Report Generation] ──► unified PDF/JSON case report, hash-linked to original, audit log entry
```

### 3.2 Tool/Model Requirements per stage

| Stage | Requirement |
|---|---|
| VAD | Must not discard low-energy speech (common in whispered/threatened-witness recordings) |
| Enhancement | Must offer a "forensic mode" (documented, reversible, non-destructive) vs. "cosmetic mode" (aggressive, for human listening only) — **never present cosmetic output as evidence** |
| ASR | Must support Hindi + at least 5 major regional languages + code-mixing; must expose per-word confidence |
| Diarization | Must handle 2-6 speakers, overlapping speech common in phone recordings |
| Authenticity | Must report method-level confidence, not just a single fused score; must flag when a clip is too short/noisy for reliable ENF analysis (avoid false certainty) |

### 3.3 Evaluation Strategy
- **Enhancement**: PESQ/STOI scores before/after; downstream WER delta on a held-out noisy Indian-language test set.
- **Transcription**: WER/CER per language on AI4Bharat's own benchmark sets (IndicSUPERB, Lahaja, Svarah) plus an internally curated Hindi-English code-mixed call-recording set (since real forensic audio ≠ clean benchmark audio).
- **Authenticity**: EER, accuracy, AUC-ROC per the AUDDT protocol (ASVspoof2019-LA, MLAAD-v5, In-the-Wild), with a **fixed 0.5 decision threshold** (not EER-tuned per test set) to reflect real deployment conditions.
- **Regression gate**: no model swap ships until it beats the current production model on all three metrics on the internal test set — this is an evidence tool, silent regressions are unacceptable.

---

## 4. Technical Specifications

### 4.1 Architecture Overview
- **Local-first core**: preprocessing, enhancement, tamper/authenticity detection, and diarization run entirely on-prem (self-hosted models) — no evidence audio leaves the network by default.
- **Optional cloud ASR**: for languages/accuracy where local models underperform, allow an opt-in cloud ASR call (e.g., ElevenLabs Scribe, or a cloud Whisper endpoint) — **gated behind an explicit per-case toggle**, logged in the audit trail, and disabled by default for sensitive cases.
- **Backend**: Python (FastAPI) service exposing a pipeline API; using FastAPI's built-in BackgroundTasks for async processing (to avoid heavy Redis/Celery dependencies for local deployments).
- **Storage**: local filesystem or on-prem object store (MinIO) for evidence; SQLite for case metadata, transcripts, audit logs (scalable to PostgreSQL if needed for larger centralized deployments).
- **Frontend**: web UI (React) for investigators — waveform/spectrogram viewer, transcript editor with timestamp scrubbing, report preview/export. Desktop-packagable (Electron/Tauri) for air-gapped deployments.

### 4.2 Integration Points
- File ingest: local upload, watched-folder ingest for bulk case intake.
- Export: PDF (signed/report-ready), JSON (machine-readable, for re-import into case management systems), SRT/VTT (subtitle-style transcript for video evidence review).
- Optional cloud APIs: ASR (ElevenLabs Scribe v2 / OpenAI Whisper API), translation (Gemini/Google Translate) — all behind a pluggable adapter interface so any provider can be swapped without touching pipeline code.

### 4.3 Security & Privacy (see security-review checklist for full detail)
- Evidence files encrypted at rest (AES-256); TLS in transit if any network hop is used.
- Role-based access control: Officer (upload/view own cases), Examiner (full technical detail, all cases), Admin (user/model management).
- No evidence content in application logs — logs contain hashes, case IDs, and operation names only.
- Every cloud API call (if enabled) logged with exact payload hash and timestamp, since this is the weakest link in chain-of-custody for a hybrid deployment.
- Compliance: aligns with Section 65B, Indian Evidence Act (certificate of authenticity for electronic evidence) and India's DPDP Act 2023 (personal data in recordings).

---

## 5. What Makes This Toolkit Unique (differentiation ideas)

1. **Dual-mode enhancement with an audit trail** — most tools just "denoise"; this one keeps a documented, reversible processing chain so a defense lawyer can't argue the evidence was fabricated by over-processing.
2. **Code-mixed-aware transcription** — explicit handling of Hindi-English/Tanglish/Benglish speech instead of forcing single-language decoding, which is where most Indian deployments of generic Whisper fail badly.
3. **ENF-based timestamp/location cross-check** — where mains-hum (50Hz India) is present in a recording, compare against a historical ENF database to estimate/verify recording date — a feature almost no open-source tool packages end-to-end.
4. **"Confidence-first" reporting** — every output (transcript segment, authenticity verdict) carries an explicit confidence/uncertainty band; nothing is presented as a bare binary "fake/real" — this is what actually holds up under cross-examination.
5. **Multi-model consensus for deepfake detection** — run 2-3 independently-trained detectors (e.g., AASIST + RawNet2 + a self-supervised-feature classifier) and report agreement/disagreement rather than trusting one model's score.
6. **Case-linked knowledge base** — transcripts and metadata across a case's multiple audio files are searchable together (e.g., "find every mention of a location across 40 intercepted calls").
7. **Offline model packaging** — ship quantized/on-device versions of all core models so the tool works in an air-gapped forensic lab, a real operational constraint most AI toolkits ignore.

---

## 6. Models to Integrate

| Task | Recommended model(s) | Notes |
|---|---|---|
| Indian ASR | **AI4Bharat IndicConformer** (600M, 22 languages) / **IndicWhisper (Vistaar)** / **vasista22 Whisper-large-v2 fine-tunes** (Apache-2.0, te/ta/hi) | IndicConformer is MIT-licensed and open; vasista22 checkpoints are the most permissively licensed open SOTA for Telugu/Tamil/Hindi |
| General/fallback ASR | OpenAI Whisper (large-v3) or ElevenLabs Scribe v2 (cloud, 90+ languages, diarization + timestamps built in) | Use as the cloud fallback behind the adapter interface, not as the default for sensitive cases |
| Speaker diarization | **pyannote-audio** (pyannote/speaker-diarization-3.1) or NVIDIA NeMo diarization | pyannote is the most widely used open pipeline; NeMo integrates well if you're already on the AI4Bharat/NeMo stack for ASR |
| Speech enhancement / denoising | **Meta Denoiser (Facebook Research)**, **DeepFilterNet**, **RNNoise** | DeepFilterNet is lightweight and real-time capable on CPU — good for on-prem deployment |
| Dereverberation / bandwidth extension | **VoiceFixer**, **Resemble-enhance** | For badly degraded phone-call audio |
| Deepfake / synthetic-speech detection | **AASIST**, **RawNet2/RawNet3**, **Wav2Vec2-based spoof classifiers** (from ASVspoof baselines) | Run as a multi-model ensemble per the "consensus" idea above |
| Translation (Indian ↔ English) | **AI4Bharat IndicTrans2**, or Gemini/NLLB as cloud fallback | IndicTrans2 is open, purpose-built for Indian languages, and can run fully offline |
| Voice activity detection | **Silero VAD** | Fast, accurate, tiny — good first filter before enhancement/ASR |

---

## 7. GitHub Repositories to Leverage

**ASR / Speech (Indian-language focus)**
- `AI4Bharat/IndicConformerASR` — https://github.com/AI4Bharat/IndicConformerASR
- `AI4Bharat/indic-asr-api-backend` — https://github.com/AI4Bharat/indic-asr-api-backend
- `AI4Bharat/vistaar` (benchmarks/fine-tunes) and `AI4Bharat/IndicTrans2`
- `NVIDIA/NeMo` — underlying toolkit AI4Bharat models are built on
- `openai/whisper` — general fallback ASR

**Diarization**
- `pyannote/pyannote-audio`

**Enhancement / Denoising**
- `facebookresearch/denoiser`
- `Rikorose/DeepFilterNet`
- `xiph/rnnoise`
- `haoheliu/voicefixer`
- `resemble-ai/resemble-enhance`

**Deepfake / Anti-spoofing**
- `clovaai/aasist`
- `asvspoof-challenge/2021` (baseline models + eval protocol)
- `TakHemlata/RawNet3` (or original `RawNet2` repos)

**Forensics / Metadata / Steganography**
- `exiftool/exiftool`
- `MediaArea/MediaInfo`
- `ReFirmLabs/binwalk`
- `zed-0xff/zsteg` (image-focused, but bundled in many stego toolchains)

**VAD / Audio Utilities**
- `snakers4/silero-vad`
- FFmpeg (`FFmpeg/FFmpeg`) — container/stream handling, backbone of preprocessing

**Case management / report scaffolding**
- No single "forensic case management" open-source repo is a perfect fit — plan to build this thin layer yourselves on FastAPI + SQLite rather than searching for one.

---

## 8. Risks & Roadmap

### Phased Rollout
- **MVP (Phase 1, ~8-10 weeks)**: Ingest + hash + metadata → enhancement (DeepFilterNet) → ASR (IndicConformer, Hindi + 2 more languages) → basic diarization (pyannote) → JSON/PDF transcript export. Local execution via SQLite + BackgroundTasks. No authenticity module yet; manual chain-of-custody logging.
- **v1.1 (Phase 2, +6-8 weeks)**: Full authenticity/tamper module (AASIST + RawNet ensemble, splice/ENF analysis), audit-trail automation, case management UI, translation layer (IndicTrans2).
- **v2.0**: Speaker verification against reference samples (with strict access control), ENF historical database cross-check, batch/bulk case processing, mobile-friendly review UI.

### Technical Risks
- **Model accuracy on real (not benchmark) forensic audio** — phone-tap/CCTV audio is far noisier than any public benchmark; budget real time for building an internal test set from representative (properly authorized/anonymized) samples.
- **Cloud fallback as a chain-of-custody weak point** — every optional cloud call must be justified and logged; treat it as an exception path, not the default.
- **Over-enhancement risk** — aggressive denoising can alter or fabricate perceived speech content; the "forensic mode / cosmetic mode" split (Section 5.1) is a hard requirement, not a nice-to-have.
- **False certainty in deepfake detection** — no model here is close to 100% reliable on out-of-distribution generation methods (per AUDDT findings on generalization gaps); the tool must communicate this limitation prominently in every report, not just in fine print.
- **Legal/compliance risk** — get the report format and terminology reviewed by an actual legal/forensic expert before this ships to real casework; this PRD is a technical starting point, not a substitute for that review.

---

## Open Questions for Next Iteration
- Exact list of target Indian languages/dialects for MVP (all 22 scheduled languages, or a prioritized subset based on caseload region?)
- Hosting environment for the "local" portion — dedicated on-prem server, or officer workstations?
- Who signs off on the authenticity report legally — does it need a human forensic examiner's countersignature workflow built into the UI?
