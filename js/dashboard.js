import { slugify } from "/js/books-data.js";
import { createBook, fetchAdminBooks, updateBook, uploadCover } from "/js/book-service.js";
import { getCurrentSession, isSupabaseConfigured } from "/js/supabase-client.js";

const form = document.getElementById("book-form");
const alertBox = document.getElementById("dashboard-alert");
const adminBooks = document.getElementById("admin-books");
const adminCount = document.getElementById("admin-count");
const submitButton = document.getElementById("submit-book");
const cancelEditButton = document.getElementById("cancel-edit-button");
const editorPanel = document.getElementById("editor-panel");
const editorTitle = document.getElementById("editor-title");
const slugPreview = document.getElementById("slug-preview");
const titleInput = document.getElementById("title");

let books = [];
let editingBook = null;

initDashboard();

async function initDashboard() {
  if (!isSupabaseConfigured()) {
    showAlert("warning", "Isi js/supabase-config.js sebelum dashboard digunakan.");
    disableForm();
    adminBooks.innerHTML = tableMessage("Supabase belum dikonfigurasi.");
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  cancelEditButton.addEventListener("click", closeEditor);
  titleInput.addEventListener("input", updateSlugPreview);
  form.addEventListener("submit", handleSubmit);
  adminBooks.addEventListener("click", handleTableClick);

  await renderAdminBooks();
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const slug = editingBook?.slug || slugify(title);
  const frontCoverFile = formData.get("front_cover_file");
  const backCoverFile = formData.get("back_cover_file");

  setLoading(true);
  showAlert("neutral", editingBook ? "Menyimpan perubahan..." : "Menyimpan buku...");

  try {
    const existingGallery = editingBook?.gallery_urls || [];
    let frontCoverUrl = editingBook?.cover_url || "";
    let backCoverUrl = existingGallery.find((url) => url && url !== frontCoverUrl) || "";

    if (frontCoverFile && frontCoverFile.size > 0) {
      frontCoverUrl = await uploadCover(frontCoverFile, slug, "front");
    }

    if (backCoverFile && backCoverFile.size > 0) {
      backCoverUrl = await uploadCover(backCoverFile, slug, "back");
    }

    if (!frontCoverUrl) throw new Error("Upload cover depan dulu.");

    const galleryUrls = [frontCoverUrl, backCoverUrl].filter(Boolean);
    const payload = {
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
      published: formData.get("published") === "on",
      sort_order: editingBook?.sort_order || getNextSortOrder(),
    };

    if (editingBook) {
      await updateBook(editingBook.id, payload);
      showAlert("success", "Buku berhasil diperbarui.");
    } else {
      await createBook(payload);
      showAlert("success", "Buku berhasil ditambahkan.");
    }

    closeEditor();
    await renderAdminBooks();
  } catch (error) {
    showAlert("error", error.message || "Buku gagal disimpan.");
  } finally {
    setLoading(false);
  }
}

async function renderAdminBooks() {
  try {
    books = await fetchAdminBooks();
    adminCount.textContent = `${books.length} buku`;
    adminBooks.innerHTML =
      books.length === 0
        ? tableMessage("Belum ada buku di Supabase.")
        : books.map(renderBookRow).join("");
  } catch (error) {
    adminBooks.innerHTML = tableMessage(error.message || "Gagal membaca daftar buku.");
  }
}

function renderBookRow(book) {
  const statusClass = book.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return `
    <tr>
      <td class="px-5 py-4">
        <div class="font-semibold text-slate-950">${escapeHtml(book.title)}</div>
        <div class="mt-1 text-xs text-slate-500">/${escapeHtml(book.slug)}</div>
      </td>
      <td class="px-5 py-4">${escapeHtml(book.author)}</td>
      <td class="px-5 py-4">${escapeHtml(book.category)}</td>
      <td class="px-5 py-4">
        <span class="rounded-full px-2 py-1 text-xs font-semibold ${statusClass}">
          ${book.published ? "Published" : "Draft"}
        </span>
      </td>
      <td class="px-5 py-4 text-right">
        <a href="/${book.slug}" class="font-semibold text-teal-700 hover:text-teal-900">View</a>
      </td>
      <td class="px-5 py-4 text-right">
        <button type="button" class="edit-book font-semibold text-slate-900 hover:text-teal-700" data-book-id="${book.id}">Edit</button>
      </td>
    </tr>
  `;
}

function handleTableClick(event) {
  const editButton = event.target.closest(".edit-book");
  if (!editButton) return;

  const book = books.find((item) => item.id === editButton.dataset.bookId);
  if (book) openEditEditor(book);
}

function openEditEditor(book) {
  editingBook = book;
  form.reset();
  editorTitle.textContent = "Edit Buku";
  submitButton.textContent = "Simpan Perubahan";

  form.elements.title.value = book.title || "";
  form.elements.author.value = book.author || "";
  form.elements.category.value = book.category || "";
  form.elements.price.value = book.price || 0;
  form.elements.isbn.value = book.isbn || "";
  form.elements.short_description.value = book.short_description || "";
  form.elements.synopsis.value = book.synopsis || "";
  form.elements.keywords.value = (book.keywords || []).join(", ");
  form.elements.buy_url.value = book.buy_url || "";
  form.elements.published.checked = Boolean(book.published);
  slugPreview.textContent = `URL buku: /${book.slug}`;
  showEditor();
}

function showEditor() {
  editorPanel.classList.remove("hidden");
  editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editingBook = null;
  form.reset();
  document.getElementById("published").checked = true;
  editorPanel.classList.add("hidden");
  submitButton.textContent = "Simpan Buku";
  updateSlugPreview();
}

function updateSlugPreview() {
  if (editingBook) return;
  const slug = slugify(titleInput.value);
  slugPreview.textContent = slug ? `URL buku: /${slug}` : "URL akan dibuat otomatis dari judul.";
}

function getNextSortOrder() {
  const maxSort = books.reduce((max, book) => Math.max(max, Number(book.sort_order || 0)), 0);
  return maxSort + 1;
}

function tableMessage(message) {
  return `
    <tr>
      <td class="px-5 py-6 text-sm text-slate-600" colspan="6">${escapeHtml(message)}</td>
    </tr>
  `;
}

function parseKeywords(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function disableForm() {
  document.querySelector('a[href="/tambah-buku.html"]')?.classList.add("pointer-events-none", "opacity-60");
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("opacity-60", isLoading);
  submitButton.textContent = isLoading ? "Menyimpan..." : editingBook ? "Simpan Perubahan" : "Simpan Buku";
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
