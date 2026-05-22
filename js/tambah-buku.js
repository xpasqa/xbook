import { slugify } from "./books-data.js";
import { createBook, fetchAdminBooks, uploadCover } from "./book-service.js";
import { getCurrentSession, isSupabaseConfigured } from "./supabase-client.js";

const form = document.getElementById("book-form");
const titleInput = document.getElementById("title");
const alertBox = document.getElementById("page-alert");
const submitButton = document.getElementById("submit-book");

let existingBooks = [];

initPage();

async function initPage() {
  if (!isSupabaseConfigured()) {
    showAlert("warning", "Isi js/supabase-config.js sebelum halaman tambah buku digunakan.");
    disableForm();
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  existingBooks = await fetchAdminBooks();
  form.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const slug = slugify(title);
  const frontCoverFile = formData.get("front_cover_file");
  const backCoverFile = formData.get("back_cover_file");

  if (!slug) {
    showAlert("error", "Judul belum valid untuk membuat URL buku.");
    return;
  }

  if (existingBooks.some((book) => book.slug === slug)) {
    showAlert("error", `Slug /${slug} sudah dipakai. Ubah judul sedikit agar URL berbeda.`);
    return;
  }

  setLoading(true);
  showAlert("neutral", "Mengupload cover dan menyimpan buku...");

  try {
    const frontCoverUrl = await uploadCover(frontCoverFile, slug, "front");
    const backCoverUrl = backCoverFile && backCoverFile.size > 0 ? await uploadCover(backCoverFile, slug, "back") : "";
    const galleryUrls = [frontCoverUrl, backCoverUrl].filter(Boolean);

    await createBook({
      title,
      slug,
      author: String(formData.get("author") || "").trim(),
      category: String(formData.get("category") || "Umum").trim(),
      price: Number(formData.get("price") || 0),
      isbn: String(formData.get("isbn") || "Dalam Proses Pengajuan").trim(),
      short_description: String(formData.get("short_description") || "").trim(),
      synopsis: String(formData.get("synopsis") || "").trim(),
      keywords: parseKeywords(formData.get("keywords")),
      cover_url: frontCoverUrl,
      cover_alt: `Cover buku ${title}`,
      gallery_urls: galleryUrls,
      buy_url: String(formData.get("buy_url") || "").trim(),
      google_books_url: String(formData.get("google_books_url") || "").trim(),
      published: formData.get("published") === "on",
      sort_order: getNextSortOrder(),
    });

    showAlert("success", "Buku berhasil ditambahkan. Mengalihkan ke dashboard...");
    window.setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 900);
  } catch (error) {
    showAlert("error", error.message || "Buku gagal disimpan.");
  } finally {
    setLoading(false);
  }
}

function getNextSortOrder() {
  const maxSort = existingBooks.reduce((max, book) => Math.max(max, Number(book.sort_order || 0)), 0);
  return maxSort + 1;
}

function parseKeywords(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function disableForm() {
  form.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = true;
    element.classList.add("opacity-60");
  });
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("opacity-60", isLoading);
  submitButton.textContent = isLoading ? "Menyimpan..." : "Simpan Buku";
}

function showAlert(type, message) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  alertBox.className = `mb-6 rounded-md border px-4 py-3 text-sm ${styles[type] || styles.neutral}`;
  alertBox.textContent = message;
}
