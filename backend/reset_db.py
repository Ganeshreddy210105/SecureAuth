import sys
from app.database.session import engine
from app.database.base import Base

def reset():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database tables reset successfully with new columns!")

if __name__ == "__main__":
    reset()
