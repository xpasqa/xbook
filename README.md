# Publion Books

Static HTML + Tailwind katalog untuk `book.publion.org`.

## Local Dev

Jalankan server lokal ini agar URL detail bisa berbentuk `/slug`:

```bash
node server.js
```

Lalu buka `http://127.0.0.1:3001/etika-akademik`.

## Struktur URL

- `/` menampilkan katalog buku.
- `/:slug` menampilkan detail buku, misalnya `/metode-riset`.
- `/login.html` untuk autentikasi Supabase.
- `/dashboard.html` untuk menambahkan buku setelah login.

## Supabase

Isi `js/supabase-config.js`:

```js
window.PUBLION_SUPABASE_URL = "https://PROJECT_ID.supabase.co";
window.PUBLION_SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY";
```

Jika config masih kosong, katalog memakai data lokal dari `js/books-data.js`.
Saat Supabase aktif, katalog tetap memakai data lokal dan menambahkan buku baru dari dashboard.
# xbook
