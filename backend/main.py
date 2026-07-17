from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import uvicorn
import shutil
import hashlib
import os
from datetime import datetime

from database import get_db, engine, Base
from models import EvidenceFile, AuditLog, Transcript
from worker import process_audio_pipeline
from security import encrypt_file

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Audio-forensics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount the uploads directory to serve audio files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to the BAFT API"}

@app.post("/api/upload")
async def upload_audio(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    pass # Deprecated in favor of batch-upload

@app.post("/api/batch-upload")
def batch_upload_audio(
    background_tasks: BackgroundTasks, 
    files: list[UploadFile] = File(...), 
    mode: str = Form("cosmetic"),
    language: str = Form("hi-IN"),
    db: Session = Depends(get_db)
):
    responses = []
    for file in files:
        # Save file temporarily
        file_ext = os.path.splitext(file.filename)[1]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Calculate SHA-256 Hash
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()
        
        # Encrypt the file at rest!
        encrypt_file(file_path)
        
        # Save to Database
        db_file = EvidenceFile(
            filename=safe_filename,
            original_filename=file.filename,
            file_path=file_path,
            sha256_hash=file_hash,
            status="uploaded",
            is_encrypted=1
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        # Log action
        audit = AuditLog(file_id=db_file.id, action="file_uploaded", details=f"File ingested with hash {file_hash}")
        db.add(audit)
        db_enc_audit = AuditLog(file_id=db_file.id, action="encryption", details="File encrypted at rest using AES-256")
        db.add(db_enc_audit)
        db.commit()
        
        # Trigger background processing
        background_tasks.add_task(process_audio_pipeline, db_file.id, file_path, mode, language)
        responses.append({"id": db_file.id, "filename": file.filename, "sha256_hash": file_hash})
        
    return {"message": f"{len(files)} files uploaded successfully", "files": responses}

@app.get("/api/file/{file_id}")
def get_file_status(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not db_file:
        return {"error": "File not found"}
        
    transcript = db.query(Transcript).filter(Transcript.file_id == file_id).first()
    audit_logs = db.query(AuditLog).filter(AuditLog.file_id == file_id).all()
    
    return {
        "id": db_file.id,
        "filename": db_file.filename,
        "original_filename": db_file.original_filename,
        "enhanced_filename": os.path.basename(db_file.enhanced_file_path) if db_file.enhanced_file_path else None,
        "is_encrypted": bool(db_file.is_encrypted),
        "sha256_hash": db_file.sha256_hash,
        "status": db_file.status,
        "transcript": transcript.content if transcript else None,
        "authenticity_report": db_file.authenticity_report,
        "speaker_verification": db_file.speaker_verification,
        "acoustic_profile": db_file.acoustic_profile,
        "audit_logs": [{"action": log.action, "details": log.details, "timestamp": log.timestamp} for log in audit_logs]
    }

@app.get("/api/cross-reference/{file_id}")
def cross_reference_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not db_file or not db_file.acoustic_profile:
        return {"matches": []}
        
    current_hash = db_file.acoustic_profile.get("signature_hash")
    
    # Find other files with the exact same signature hash (our mock consistency check)
    matches = []
    all_files = db.query(EvidenceFile).filter(EvidenceFile.id != file_id).all()
    for other_file in all_files:
        if other_file.acoustic_profile and other_file.acoustic_profile.get("signature_hash") == current_hash:
            matches.append({
                "id": other_file.id,
                "original_filename": other_file.original_filename,
                "match_reason": f"Acoustic signature match (Hash: {current_hash})"
            })
            
    return {"matches": matches}

@app.get("/api/audio/{filename}")
def get_audio_file(filename: str):
    from fastapi.responses import Response
    from security import cipher_suite
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
        
    with open(file_path, 'rb') as f:
        encrypted_data = f.read()
    try:
        decrypted_data = cipher_suite.decrypt(encrypted_data)
    except:
        # If it fails to decrypt, assume it's unencrypted
        decrypted_data = encrypted_data
        
    return Response(content=decrypted_data, media_type="audio/wav")

@app.delete("/api/file/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not db_file:
        return {"error": "File not found"}
        
    # Delete associated file on disk
    if db_file.file_path and os.path.exists(db_file.file_path):
        os.remove(db_file.file_path)
        
    # Delete from database
    db.query(Transcript).filter(Transcript.file_id == file_id).delete()
    db.query(AuditLog).filter(AuditLog.file_id == file_id).delete()
    db.delete(db_file)
    db.commit()
    
    return {"message": "File deleted successfully"}

@app.get("/api/cases")
def get_all_cases(db: Session = Depends(get_db)):
    files = db.query(EvidenceFile).order_by(EvidenceFile.created_at.desc()).all()
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "original_filename": f.original_filename,
            "status": f.status,
            "created_at": f.created_at.isoformat()
        } for f in files
    ]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
