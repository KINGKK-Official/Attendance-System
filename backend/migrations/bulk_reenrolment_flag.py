"""
Task 11 — Flag students for re-enrolment when the active recognition model
changes (e.g. switching FACE_RECOGNITION_MODEL from 'sface' to 'adaface').

Any student whose stored model_version differs from the active model is marked
needs_reenrolment = True so the live pipeline skips AI matching for them and
faculty fall back to manual until they are re-enrolled.

Usage:
    python -m backend.migrations.bulk_reenrolment_flag --model adaface
    python -m backend.migrations.bulk_reenrolment_flag --model adaface --dry-run
"""
import argparse
import os
import sys

from ..models import schemas, database


def run(active_model: str, dry_run: bool = False):
    db = database.SessionLocal()
    flagged = 0
    cleared = 0
    try:
        for s in db.query(schemas.Student).all():
            mismatch = (s.model_version or "sface") != active_model
            if mismatch and not s.needs_reenrolment:
                if dry_run:
                    print(f"  [dry-run] would flag {s.id} (stored={s.model_version} active={active_model})")
                else:
                    s.needs_reenrolment = True
                flagged += 1
            elif (not mismatch) and s.needs_reenrolment:
                if not dry_run:
                    s.needs_reenrolment = False
                cleared += 1
        if not dry_run:
            db.commit()
        print(f"\nDone. flagged={flagged} cleared={cleared} active_model={active_model} dry_run={dry_run}")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.environ.get("FACE_RECOGNITION_MODEL", "sface"),
                        help="The newly active model (sface|adaface)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(active_model=args.model.lower().strip(), dry_run=args.dry_run)
