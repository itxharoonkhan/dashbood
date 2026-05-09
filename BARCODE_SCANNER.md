# Barcode Scanner — Kaise Setup Karo aur Kaise Kaam Karta Hai

---

## USB Scanner Kaise Kaam Karta Hai?

USB Barcode Scanner computer ko lagta hai toh woh **keyboard ki tarah behave karta hai**:
- Barcode scan karo → scanner bohot tezi se characters type karta hai (har character ~5ms mein)
- End mein automatically **Enter** press karta hai

**Normal typing** slow hoti hai (100-300ms per key)  
**Scanner typing** fast hoti hai (1-5ms per key)

Hum yahi farq detect karte hain aur samajhte hain ke yeh scanner hai, insaan nahi.

---

## Step-by-Step Setup

### Step 1 — Scanner Lagao
- USB Barcode Scanner ko laptop/PC ke USB port mein lagao
- Koi driver install nahi karna — Windows automatically detect kar leta hai

### Step 2 — Product mein Barcode Save Karo
- **Inventory** page pe jao
- Koi product edit karo
- **Barcode** field mein us product ka barcode number likho
  - Example: `8901234567890`
- Save karo

### Step 3 — POS Terminal pe Scan Karo
- **Sales (POS)** page open karo
- Scanner se product pe point karo aur trigger dabaao
- Screen ke upar yeh dikhega:
  ```
  📷 Barcode Scanning... 8901234567890
  ```
- Product automatically **cart mein add** ho jayega ✅

---

## Kya Hoga Har Case Mein?

| Situation | Kya Hoga |
|---|---|
| Barcode scan hua, product mila | Product cart mein add ho jayega |
| Barcode scan hua, product nahi mila | Red toast: "Barcode Not Found" |
| Product out of stock hai | Red toast: "Out of Stock" |
| Normal keyboard typing | Kuch nahi hoga (ignore) |

---

## Code Mein Kahan Hai?

| File | Kya Kaam Karta Hai |
|---|---|
| `Backend/routes/products.js` | `GET /products/barcode/:code` — barcode se product dhundta hai |
| `frontend/src/app/sales/page.tsx` | Keyboard events sun ta hai, fast typing detect karta hai, API call karta hai |

---

## Agar Kaam Na Kare — Troubleshoot

**Problem:** Scan kiya lekin kuch nahi hua  
**Solution:** Check karo ke POS page focused hai (kisi input field pe click na ho)

**Problem:** "Barcode Not Found" aa raha hai  
**Solution:** Inventory mein us product ka barcode field fill karo — exact same number jo scanner read kar raha hai

**Problem:** Product baar baar add ho raha hai  
**Solution:** Normal — scanner trigger ek baar dabaao, ek baar add hoga

---

## MySQL Mein Barcode Kaise Check Karo

```sql
-- Kisi product ka barcode dekhna
SELECT id, name, barcode FROM products WHERE barcode IS NOT NULL;

-- Barcode manually add karna
UPDATE products SET barcode = '8901234567890' WHERE id = 1;
```
