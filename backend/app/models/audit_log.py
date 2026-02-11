"""
Audit Log Model - System-wide activity tracking and security logging
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    """
    AuditLog - Tracks all important system activities for security and compliance.
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for system events

    event_type = Column(String(50), nullable=False, index=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    
    # Status
    status = Column(String(20), default="success")  # success, failure, warning
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog {self.event_type} by user {self.user_id} at {self.created_at}>"
