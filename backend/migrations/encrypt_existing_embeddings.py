"""
Task 6 — One-time migration: encrypt existing plaintext face embeddings.

Reads every student that still has a legacy plaintext `face_embedding` (JSON
text) and no encrypted blob, encrypts it into `face_embedding_enc`, and clears
the plaintext column.

Usage:
    python -m backend.migrations.encrypt_existing_embeddings --dry-run
    python -m backend.migrations.encrypt_existing_embeddings

Requires BIOMETRIC_ENCRYPTION_KEY to be set for real (non-dry-run) execution.
"""
import argparse

import sys

from ..models import schemas, database
from ..services import crypto_service


def run(dry_run: bool = False):
    db = database.SessionLocal()
    migrated = 0
    skipped = 0
    try:
        students = db.query(schemas.Student).all()
        for s in students:
            if s.face_embedding_enc:
                skipped += 1
                continue
            if not s.face_embedding:
                skipped += 1
                continue
            emb = crypto_service.embedding_to_list(s.face_embedding)
            if emb is None:
                print(f"  ! could not parse embedding for student {s.id}; skipping")
                skipped += 1
                continue
            if dry_run:
                print(f"  [dry-run] would encrypt embedding for student {s.id} ({len(emb)}-d)")
                migrated += 1
                continue
            s.face_embedding_enc = crypto_service.encrypt_embedding(emb)
            s.face_embedding = None
            if not s.model_version:
                s.model_version = "sface"
            migrated += 1
            print(f"  encrypted embedding for student {s.id}")

        if not dry_run:
            db.commit()
        print(f"\nDone. migrated={migrated} skipped={skipped} dry_run={dry_run}")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Report without writing changes")
    args = parser.parse_args()
    if not args.dry_run and not crypto_service.is_enabled():
        print("Refusing to run without BIOMETRIC_ENCRYPTION_KEY set. Use --dry-run to preview.")
        sys.exit(2)
    run(dry_run=args.dry_run)
