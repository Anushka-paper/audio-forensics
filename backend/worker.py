import os
import sys

# Add root folder to sys path to import ml_pipeline
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_pipeline.pipeline import process_file
from database import SessionLocal
from models import EvidenceFile, Transcript, AuditLog

from security import decrypt_file, encrypt_file

def process_audio_pipeline(file_id: int, file_path: str, mode: str = "cosmetic", language: str = "hi-IN"):
    """
    Main Celery task that coordinates the audio forensics pipeline.
    """
    db = SessionLocal()
    temp_files_to_delete = []
    try:
        # Update status to processing
        db_file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
        if db_file:
            db_file.status = "processing"
            db.commit()
            
            # Log action
            audit = AuditLog(file_id=file_id, action="processing_started", details=f"Started ML pipeline in {mode} mode for language {language}")
            db.add(audit)
            db.commit()
            
        # 1. Decrypt file for processing
        decrypted_path = f"{file_path}_decrypted_temp.wav"
        decrypt_file(file_path, decrypted_path)
        temp_files_to_delete.append(decrypted_path)

        # 2. Run ML Pipeline
        pipeline_results = process_file(decrypted_path, mode=mode, language=language)
        
        transcript_data = pipeline_results["transcript"]
        authenticity_report = pipeline_results["authenticity"]
        speaker_verification = pipeline_results["speaker_verification"]
        acoustic_profile = pipeline_results["acoustic_profile"]
        enhanced_path = pipeline_results.get("enhanced_path")
        
        if enhanced_path and os.path.exists(enhanced_path):
            # Encrypt enhanced file
            encrypt_file(enhanced_path)
        
        if db_file:
            # Save Transcript
            transcript = Transcript(file_id=file_id, content=transcript_data)
            db.add(transcript)
            
            # Save Authenticity Report & Update File status
            db_file.authenticity_report = authenticity_report
            db_file.speaker_verification = speaker_verification
            db_file.acoustic_profile = acoustic_profile
            if enhanced_path:
                db_file.enhanced_file_path = enhanced_path
            db_file.status = "completed"
            
            # Log action
            audit = AuditLog(file_id=file_id, action="processing_completed", details="ML pipeline completed successfully")
            db.add(audit)
            
            db.commit()
            
        return {"status": "success", "file_id": file_id, "message": "Pipeline completed successfully"}
    except Exception as e:
        db_file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
        if db_file:
            db_file.status = "failed"
            audit = AuditLog(file_id=file_id, action="processing_failed", details=f"Error: {str(e)}")
            db.add(audit)
            db.commit()
        raise e
    finally:
        for tmp_file in temp_files_to_delete:
            if os.path.exists(tmp_file):
                try:
                    os.remove(tmp_file)
                except:
                    pass
        db.close()

