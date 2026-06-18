#!/usr/bin/env python3
"""
MediSavings - Seed Script
Διαβάζει το Excel και εισάγει τα δεδομένα στη Supabase.

Χρήση:
  pip install pandas openpyxl supabase
  python seed.py
"""

import math
import pandas as pd
from supabase import create_client

# ─── ΣΥΜΠΛΗΡΩΣΕ ΤΑ ΣΤΟΙΧΕΙΑ ΣΟΥ ───────────────────────────────────────────
SUPABASE_URL = 'https://odtbtugzilxsfqxlpofq.supabase.co'
SUPABASE_KEY = 'sb_publishable_ch-7C1ihpZRrxEhXFqV1xA_hXPwq61S'
EXCEL_FILE = 'data.xlsx'
# ────────────────────────────────────────────────────────────────────────────

def clean(v):
    """Καθαρίζει τιμές για JSON - αφαιρεί NaN/Inf/κενά."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, str) and v.strip() == '':
        return None
    return v

def round2(v):
    if v is None:
        return None
    try:
        return round(float(v), 4)
    except Exception:
        return None

def parse_excel(filepath):
    df = pd.read_excel(filepath, header=0)
    records = []

    skip_descriptions = {'ΣΥΝΟΛΑ', 'ΚΑΤΑΡΓΗΣΗ', 'ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ', ''}

    for _, r in df.iterrows():
        old_code = clean(r.get('ΚΩΔΙΚΟΣ'))
        new_code = clean(r.get('ΚΩΔΙΚΟΣ.1'))
        old_desc = clean(r.get('ΠΕΡΙΓΡΑΦΗ'))
        new_desc = clean(r.get('ΠΕΡΙΓΡΑΦΗ.1'))

        if not old_code or not new_code or not old_desc:
            continue
        if str(old_desc).strip().upper() in skip_descriptions:
            continue
        if str(new_desc or '').strip().upper() in skip_descriptions:
            continue

        rec = {
            # Παλιό υλικό
            'old_code':        str(old_code).strip(),
            'old_description': str(old_desc).strip(),
            'old_supplier':    str(clean(r.get('ΕΤΑΙΡΕΙΑ')) or '').strip() or None,
            'old_price':       round2(clean(r.get('ΠΑΛΙΑ ΤΙΜΗ ΥΛΙΚΟΥ'))),

            # Νέο υλικό
            'new_code':        str(new_code).strip(),
            'new_description': str(new_desc).strip() if new_desc else None,
            'new_supplier':    str(clean(r.get('ΕΤΑΙΡΕΙΑ.1')) or '').strip() or None,
            'new_price':       round2(clean(r.get('ΝΕΑ ΤΙΜΗ TMX'))),

            # Σύγκριση τιμών
            'price_diff':          round2(clean(r.get('ΔΙΑΦΟΡΑ \nΤΙΜΗΣ'))),
            'price_reduction_pct': round2(clean(r.get('ΠΟΣΟΣΤΙΑΙΑ ΜΕΙΩΣΗ ΤΙΜΗΣ'))),

            # Αγορές
            'purchases_2024':     round2(clean(r.get('ΣΥΝΟΛΙΚΕΣ ΑΓΟΡΕΣ 2024'))),
            'purchases_2025_old': round2(clean(r.get('ΑΓΟΡΕΣ 2025 ΠΑΛΙΟΥ ΥΛΙΚΟΥ/ΠΑΛΙΑ ΤΙΜΗ'))),
            'purchases_2025_new': round2(clean(r.get('ΑΓΟΡΕΣ 2025 ΝΕΟΥ ΥΛΙΚΟΥ/ΝΕΑ ΤΙΜΗ'))),
            'purchases_2026_h1':  round2(clean(r.get('ΑΓΟΡΕΣ 1ου 6ΜΗΝΟΥ 2026 ΝΕΟΥ ΥΛΙΚΟΥ/ΝΕΑ ΤΙΜΗ'))),

            # Κατανάλωση
            'consumption_2024': round2(clean(r.get(' ΚΑΤΑΝΑΛΩΣΗ 2024'))),
            'consumption_2025': round2(clean(r.get(' ΚΑΤΑΝΑΛΩΣΗ 2025'))),
            'consumption_2026': round2(clean(r.get(' ΚΑΤΑΝΑΛΩΣΗ 2026'))),

            # Κόστη & εξοικονόμηση
            'cost_old_price_2025':   round2(clean(r.get('ΕΤΗΣΙΟ ΚΟΣΤΟΣ ΚΑΤΑΝΑΛΩΣΗΣ ΒΑΣΕΙ ΠΟΣΟΤΗΤΩΝ  2025 ΜΕ ΤΗΝ ΠΑΛΙΑ ΤΙΜΗ'))),
            'cost_new_price_2025':   round2(clean(r.get('ΕΤΗΣΙΟ ΚΟΣΤΟΣ ΚΑΤΑΝΑΛΩΣΗΣ ΒΑΣΕΙ ΠΟΣΟΤΗΤΩΝ 2025 ΜΕ ΤΗΝ ΝΕΑ  ΤΙΜΗ'))),
            'annual_saving_2025':    round2(clean(r.get('ΕΤΗΣΙΑ ΑΝΑΓΩΓΗ   ΚΕΡΔΟΥΣ ΜΕ ΒΑΣΗ ΤΗΝ ΚΑΤΑΝΑΛΩΣΗ ΤΟΥ 2025 ΑΠΌ ΤΗΝ ΝΕΑ ΤΙΜΗ'))),
            'saving_from_purchases': round2(clean(r.get('ΟΦΕΛΟΣ ΑΠΌ ΤΙΣ ΑΓΟΡΕΣ ΜΕ ΤΟ ΝΈΟ ΕΙΔΟΣ/ΤΙΜΗ\n'))),

            # Defaults
            'status': 'active',
        }
        records.append(rec)

    return records


def main():
    print(f"📂 Διαβάζω: {EXCEL_FILE}")
    records = parse_excel(EXCEL_FILE)
    print(f"✅ Βρέθηκαν {len(records)} εγγραφές")

    print(f"🔌 Σύνδεση στη Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Εισαγωγή σε batches των 20
    batch_size = 20
    total_inserted = 0
    errors = []

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            result = supabase.table('material_changes').insert(batch).execute()
            total_inserted += len(batch)
            print(f"  ✓ Batch {i//batch_size + 1}: {len(batch)} εγγραφές εισήχθησαν")
        except Exception as e:
            print(f"  ✗ Batch {i//batch_size + 1} ΣΦΑΛΜΑ: {e}")
            errors.append(str(e))

    print(f"\n{'='*50}")
    print(f"✅ Εισήχθησαν: {total_inserted}/{len(records)} εγγραφές")
    if errors:
        print(f"❌ Σφάλματα: {len(errors)}")
        for e in errors:
            print(f"   - {e}")
    else:
        print("🎉 Όλα εισήχθησαν επιτυχώς!")


if __name__ == '__main__':
    main()
