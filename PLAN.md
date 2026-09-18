# Kamera barcode scannerdan foydalanish

`CameraBarcodeScanner` kamera ikonkasi ko‘rinishidagi client komponentdir. Ikonka bosilganda kamera uchun ruxsat so‘raladi, barcode aniqlansa kamera avtomatik to‘xtaydi va qiymat `onDetected` callbackiga uzatiladi.

## Import qilish

```tsx
import CameraBarcodeScanner from '@/components/pos/CameraBarcodeScanner';
```

## Mahsulot formasi maydonini to‘ldirish

`onDetected` ichida barcode qiymatini form state’iga yozing:

```tsx
<CameraBarcodeScanner
  onDetected={(barcode) => {
    setFormData((current) => ({ ...current, barcode }));
  }}
/>
```

Komponentni barcode `Input` yoniga qo‘ying. Foydalanuvchi “Saqlash” tugmasini bosganda mavjud mahsulot yaratish yoki yangilash API so‘rovi barcode qiymatini bazaga yuboradi.

## POS’da mahsulotni topish

Barcode o‘qilganda uni qidiruvga yuborish mumkin:

```tsx
<CameraBarcodeScanner
  onDetected={async (barcode) => {
    const response = await api.products.findByBarcode(organization.id, barcode);

    if (response.data) {
      addItem(response.data);
    }
  }}
/>
```

Bu usul `GET /api/products?organizationId=...&barcode=...` endpointi orqali bazadan mahsulotni topadi va uni savatga qo‘shadi.

## Eslatma

- Kamera faqat `https` yoki `localhost` manzilida ishlaydi.
- Brauzer kamera ruxsatini rad etsa, foydalanuvchi sayt ruxsatlaridan uni yoqishi kerak.
- Komponent 1D barcode va QR kodlarni o‘qiydi.
