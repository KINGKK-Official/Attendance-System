# Attendance System MVP

Welcome to the Attendance System MVP! This guide will walk you through setting up and running the project from scratch on any system.

## Prerequisites

If you are running this on a completely fresh system, you will need to install the following tools first:

1. **Python 3.10+**: For running the backend server.
   - Download from: [python.org/downloads](https://www.python.org/downloads/)
   - *Note: Make sure to check the box "Add Python to PATH" during installation.*
2. **Node.js 18+ & npm**: For running the React frontend.
   - Download from: [nodejs.org](https://nodejs.org/)
3. **Docker Desktop**: For running PostgreSQL (Database), Redis, and Kafka.
   - Download from: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
4. **Git** (Optional but recommended):
   - Download from: [git-scm.com/downloads](https://git-scm.com/downloads)

---

## 1. Database Setup (PostgreSQL)

The system uses PostgreSQL for data storage. The easiest way to run PostgreSQL locally is via Docker.

**Open Terminal 1** and run the following command to start a PostgreSQL container:
```bash
docker run --name attendance-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=attendance_mvp -p 54322:5432 -d postgres:15
```
*(This starts a database on port `54322` matching the default `.env` configuration).*

---

## 2. Backend Setup (FastAPI)

The backend is built with Python and FastAPI.

**Open Terminal 2** and navigate to the project root directory:

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Create a Python Virtual Environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment:**
   - **Windows:**
     ```bash
     .\venv\Scripts\activate
     ```
   - **Mac/Linux:**
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(If you don't have a `requirements.txt`, run: `pip install fastapi uvicorn sqlalchemy psycopg2-binary passlib[bcrypt] python-jose python-multipart pydantic-settings python-dotenv`)*

5. **Start the Backend Server:**
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   *The backend should now be running at `http://localhost:8000`.*

6. **Seed the Database (First Run Only):**
   Open a new terminal, activate the virtual environment, and run:
   ```bash
   python seed.py
   ```
   *(This will create the test accounts, dummy students, and a demo course so the database isn't empty).*

---

## 3. Frontend Setup (React + Vite)

The frontend is a React application built with Vite.

**Open Terminal 3** and navigate to the project root directory:

1. **Navigate to the frontend folder:**
   ```bash
   cd frontend
   ```

2. **Install Node Modules:**
   ```bash
   npm install
   ```

3. **Start the Frontend Development Server:**
   ```bash
   npm run dev
   ```
   *The frontend should now be running (usually at `http://localhost:5173`). Open this link in your browser.*

---

## 4. (Optional) Advanced Workers (Redis & Kafka)

If you plan to run the heavy AI face-recognition workers (Tier 1 & Tier 2) or Analytics, the project includes a `docker-compose.yml` file for spinning up Redis, Zookeeper, and Kafka.

**Open Terminal 4** at the project root and run:
```bash
docker-compose up -d redis kafka zookeeper
```
You can then run the workers in separate terminals using:
```bash
# From the backend folder (with venv activated)
python -m workers.cv_tier1_worker
python -m workers.cv_tier2_worker
```

---

## Summary of Terminals Needed

To run the basic complete system, you will need **2 active terminals** (plus one background Docker process):
- **Terminal 1:** Running the Backend (`uvicorn main:app`)
- **Terminal 2:** Running the Frontend (`npm run dev`)
- **Docker Background:** Running PostgreSQL database

## Default Accounts

The database comes pre-seeded with the following test accounts for all roles. All test accounts share the same default password: `testpassword123`

| Role | Name | Email |
|------|------|-------|
| **Admin** | Test Admin | `admin@test.com` |
| **IT Manager** | Test IT Manager | `itmanager@test.com` |
| **HOD** | Test HOD | `hod@test.com` |
| **Dean** | Test Dean | `dean@test.com` |
| **Faculty (Analyzer)** | Test Analyzer | `analyzer@test.com` |
| **Student** | Test Student | `student@test.com` |

*(Note: You can log into the Admin dashboard and use the **User Management** page to change their roles, emails, and passwords.)*
