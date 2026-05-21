# Publion Books

Static HTML + Tailwind katalog untuk `book.publion.org`.

## Struktur URL

- `/` menampilkan katalog buku.
- `/:slug` menampilkan detail buku, misalnya `/metode-riset`.
- `/login` untuk autentikasi Supabase.
- `/dashboard` untuk menambahkan buku.

## Supabase

Isi `js/supabase-config.js`:

```js
window.PUBLION_SUPABASE_URL = "https://PROJECT_ID.supabase.co";
window.PUBLION_SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY";
```

Jika config masih kosong, katalog memakai data lokal dari `js/books-data.js`.
Saat Supabase aktif, katalog tetap memakai data lokal dan menambahkan buku baru dari dashboard.
# xbook
