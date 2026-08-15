# Attendance MVP - AI-Driven Automated Attendance System

## What This Is
An AI-powered attendance system for IQRA University (IU) that uses computer vision to automate student tracking via a "Hit-Based" system. It eliminates manual sign-ins by capturing student faces at specific intervals during class sessions.

## Core Value
Provides high-fidelity, automated attendance tracking that reduces faculty workload and ensures data integrity through scheduled AI "Hits" and manual override capabilities.

## Context
- **Stage**: MVP Prototype
- **Target**: IQRA University
- **Focus**: Core CV Engine, Hit-Based Attendance, RBAC.

## Tech Stack
- **Frontend**: React (SPA)
- **Backend**: FastAPI
- **CV Engine**: OpenCV + ArcFace/FaceNet
- **Database**: Microsoft SQL Server (SSMS)

## User Roles
1. **Admin**: Project management, user/student enrollment, biometric capture.
2. **Faculty**: Attendance session triggers, verification, manual overrides, reports.

## Key Decisions
- **Hit-Based Logic**: 2 hits per session to balance accuracy and performance.
- **RBAC**: Strict separation between Admin and Faculty dashboards.
- **Embedded Face Embeddings**: 512-d vectors stored in DB for fast comparison.
