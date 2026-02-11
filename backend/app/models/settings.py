"""
Settings Models - User preferences, and notifications.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class NotificationSettings(Base):
    """
    NotificationSettings - User notification preferences.
    """
    __tablename__ = "notification_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Email notifications
    email_new_assignment = Column(Boolean, default=True)
    email_assignment_graded = Column(Boolean, default=True)
    email_due_date_reminder = Column(Boolean, default=True)
    
    # Reminder timing (hours before deadline)
    due_date_reminder_hours = Column(Integer, default=24)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="notification_settings")
    
    def __repr__(self):
        return f"<NotificationSettings user={self.user_id}>"


class UserPreferences(Base):
    """
    UserPreferences - User interface and editor preferences.
    """
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Theme
    theme = Column(String(20), default="light")  # light, dark, system
    
    # Editor settings
    editor_theme = Column(String(50), default="vs-dark")  # Monaco editor themes
    editor_font_size = Column(Integer, default=14)
    
    # Language
    language = Column(String(10), default="en")  # Interface language

    
    # Default programming language
    default_language_id = Column(Integer, ForeignKey("languages.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")
    
    def __repr__(self):
        return f"<UserPreferences user={self.user_id}>"