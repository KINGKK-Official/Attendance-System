import sqlite3

def update_emails():
    db_path = "attendance_mvp.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # First, handle the admin@iqra.edu.pk which conflicts with admin@gmail.com
    cursor.execute("DELETE FROM users WHERE email = 'admin@iqra.edu.pk'")
    
    cursor.execute("SELECT id, email, full_name, role FROM users")
    users = cursor.fetchall()
    
    print("User Credentials (Assumed default passwords):")
    for user_id, email, full_name, role in users:
        if email and "@iqra.edu.pk" in email:
            new_email = email.replace("@iqra.edu.pk", "@gmail.com")
            try:
                cursor.execute("UPDATE users SET email = ? WHERE id = ?", (new_email, user_id))
                print(f"- {full_name} ({role}): {new_email} (Password: likely {role.lower()}123 or {new_email.split('@')[0]}123)")
            except sqlite3.IntegrityError:
                print(f"Skipping {email}, {new_email} already exists.")
                # We can delete the old one if it's duplicate
                cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        else:
            print(f"- {full_name} ({role}): {email} (Password: likely {role.lower()}123 or {email.split('@')[0]}123)")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_emails()
