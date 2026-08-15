from sqlalchemy import create_engine, text

engine = create_engine(r'mssql+pyodbc://@.\SQLEXPRESS/attendance_db?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes&Trusted_Connection=yes')
conn = engine.connect()

# Fix existing 1.5hr courses that have 08:30-09:50 (or 08:30-11:20) to be exactly 08:30-09:40
conn.execute(text("UPDATE courses SET time_slot='08:30-09:40' WHERE course_type='1.5hr' AND (time_slot='08:30-11:20' OR time_slot='08:30-09:50')"))
conn.commit()
print("Fixed time slots for existing courses to exactly 08:30-09:40.")
