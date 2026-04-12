from app.core.database import Base, engine
import app.models
Base.metadata.create_all(bind=engine)
print("All tables created successfully")
