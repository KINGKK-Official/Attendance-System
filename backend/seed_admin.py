from .models import schemas, database
from .services import auth_service
from sqlalchemy.orm import Session

def seed_admin():
    db = next(database.get_db())
    
    # Check if admin already exists
    admin_email = "admin@gmail.com"
    admin_user = db.query(schemas.User).filter(schemas.User.email == admin_email).first()
    
    if not admin_user:
        print(f"Creating admin user: {admin_email}")
        hashed_password = auth_service.get_password_hash("admin123")
        new_admin = schemas.User(
            full_name="System Admin",
            email=admin_email,
            password_hash=hashed_password,
            role=schemas.UserRole.ADMIN
        )
        db.add(new_admin)
        db.commit()
        print("Admin user created successfully!")
    else:
        print("Admin user already exists.")

if __name__ == "__main__":
    seed_admin()
