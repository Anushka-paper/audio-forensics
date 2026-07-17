from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Case(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    files = relationship("EvidenceFile", back_populates="case")

class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    original_filename = Column(String)
    file_path = Column(String)
    enhanced_file_path = Column(String, nullable=True)
    is_encrypted = Column(Integer, default=1) # 1 for True, 0 for False (SQLite boolean)
    sha256_hash = Column(String, unique=True, index=True)
    status = Column(String, default="uploaded") # uploaded, processing, completed, failed
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    authenticity_report = Column(JSON, nullable=True) # Deepfake score, splice points
    speaker_verification = Column(JSON, nullable=True) # Target match data
    acoustic_profile = Column(JSON, nullable=True) # Environmental noise and acoustics
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    case = relationship("Case", back_populates="files")
    transcripts = relationship("Transcript", back_populates="file")
    audit_logs = relationship("AuditLog", back_populates="file")

class Transcript(Base):
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("evidence_files.id"))
    content = Column(JSON) # Stores diarized transcript segments
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    file = relationship("EvidenceFile", back_populates="transcripts")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("evidence_files.id"))
    action = Column(String) # e.g., "upload", "enhancement_started", "asr_completed"
    details = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    file = relationship("EvidenceFile", back_populates="audit_logs")
