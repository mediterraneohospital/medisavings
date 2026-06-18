# MediSavings 💰
**Cost Savings Tracker — Mediterraneo Hospital**

Web app παρακολούθησης εξοικονόμησης κόστους από αλλαγές αναλώσιμων υλικών.

---

## 🚀 Setup (4 βήματα)

### 1. Δημιούργησε τον πίνακα στη Supabase
- Άνοιξε το Supabase project σου
- Πήγαινε **SQL Editor**
- Τρέξε το αρχείο `supabase_schema.sql`

### 2. Συμπλήρωσε τα credentials
Άνοιξε το `js/supabase.js` και βάλε:
```js
const SUPABASE_URL = 'https://XXXXXXXXXXXX.supabase.co';
const SUPABASE_KEY = 'your-anon-key-here';
```
*(Τα βρίσκεις στο Supabase → Settings → API)*

### 3. Εισαγωγή δεδομένων από Excel
```bash
pip install pandas openpyxl supabase
# Βάλε το Excel στον ίδιο φάκελο με το seed.py
# Συμπλήρωσε URL + KEY στο seed.py
python seed.py
```

### 4. Deploy στο GitHub Pages
```bash
git init
git add .
git commit -m "Initial MediSavings"
git remote add origin https://github.com/mediterraneohospital/medisavings.git
git push -u origin main
# Ενεργοποίησε GitHub Pages → main branch
```

---

## 📁 Αρχεία
```
medisavings/
├── index.html          ← Λίστα αλλαγών + stats
├── add.html            ← Καταχώρηση / επεξεργασία
├── detail.html         ← Λεπτομέρειες εγγραφής
├── supabase_schema.sql ← SQL για τη βάση
├── seed.py             ← Import από Excel
├── js/
│   ├── supabase.js     ← Config + helpers
│   ├── list.js         ← Λογική λίστας
│   └── form.js         ← Λογική form
└── css/
    └── style.css       ← Teal theme
```

---

## 🔜 Επόμενη έκδοση
- Dashboard με γραφήματα εξοικονόμησης
- Export Excel/PDF
- Φίλτρο ανά κατηγορία & έτος
- Ιστορικό αλλαγών τιμών
