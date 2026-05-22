import { fetchBookBySlug } from "./book-service.js";

const detail = document.getElementById("book-detail");
let currentGallery = [];
let galleryTimer;

initDetail();

async function initDetail() {
  const slug = getCurrentSlug();
  if (!slug) {
    renderNotFound();
    return;
  }

  const { book } = await fetchBookBySlug(slug);
  if (!book) {
    renderNotFound();
    return;
  }

  document.title = `${book.title} | Publion Research`;
  document.querySelector("meta[name='description']")?.setAttribute("content", book.short_description || book.synopsis);
  renderDetail(book);
}

function getCurrentSlug() {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("slug");
  if (querySlug) return querySlug;

  const parts = window.location.pathname.split("/").filter(Boolean);
  const lastPart = parts.at(-1) || "";
  const slug = lastPart.replace(/\.html$/, "");
  if (!slug || slug === "detail") return "";
  return slug;
}

function renderDetail(book) {
  currentGallery = [...new Set([book.cover_url, ...(book.gallery_urls || [])].filter(Boolean))];
  const buyUrl = book.buy_url || `mailto:editor@publion.id?subject=${encodeURIComponent(`Beli Buku: ${book.title}`)}`;
  const googleBooksUrl =
    book.google_books_url || `https://books.google.com/books?q=${encodeURIComponent(`${book.title} ${book.author}`)}`;
  detail.innerHTML = `
    <nav class="mb-8 text-sm text-slate-500" aria-label="Breadcrumb">
      <a href="/" class="font-medium text-slate-700 transition hover:text-slate-950">Katalog</a>
      <span class="mx-2">/</span>
      <span class="text-slate-500">${escapeHtml(book.title)}</span>
    </nav>

    <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(300px,390px)_1fr]">
      <aside class="w-full lg:max-w-[390px]">
        <div class="sticky top-24">
          <div class="overflow-hidden rounded-md">
            <img data-cover-preview src="${book.cover_url}" alt="${escapeHtml(book.cover_alt)}" class="aspect-[5/8] w-full object-cover" />
          </div>
          ${
            currentGallery.length > 1
              ? `
                <div class="mt-3 flex items-center justify-between">
                  <button type="button" data-gallery-dir="-1" class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-950 transition hover:bg-slate-50" aria-label="Cover sebelumnya">
                    <span aria-hidden="true">&larr;</span>
                  </button>
                  <div data-gallery-counter class="text-xs font-semibold text-slate-500">1/${currentGallery.length}</div>
                  <button type="button" data-gallery-dir="1" class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-950 transition hover:bg-slate-50" aria-label="Cover berikutnya">
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </aside>

      <article class="max-w-4xl">
        <div class="border-b border-slate-200 pb-6">
          <div>
            <p class="text-sm font-semibold text-teal-700">${escapeHtml(book.category || "Umum")}</p>
            <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">${escapeHtml(book.title)}</h1>
            <p class="mt-3 text-base text-slate-600">Penulis: ${escapeHtml(book.author)}</p>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${renderMeta("Harga", book.price_label)}
          ${renderMeta("ISBN", book.isbn || "Dalam Proses Pengajuan")}
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="${escapeHtml(buyUrl)}"
            class="inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            Beli Buku
          </a>
          <a
            href="${escapeHtml(googleBooksUrl)}"
            target="_blank"
            rel="noopener"
            class="inline-flex w-full items-center justify-center rounded-md bg-[#4285f4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3367d6]"
          >
            Cari di Google Books
          </a>
        </div>

        <section class="mt-10">
          <h2 class="text-xl font-bold text-slate-950">Sinopsis</h2>
          <p class="mt-3 text-base leading-8 text-slate-700">${escapeHtml(book.synopsis)}</p>
        </section>

        <section class="mt-10">
          <h2 class="text-xl font-bold text-slate-950">Kata Kunci</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            ${(book.keywords || [])
              .map((keyword) => `<span class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">${escapeHtml(keyword)}</span>`)
              .join("")}
          </div>
        </section>
      </article>
    </div>
  `;

  bindGallery();
}

function renderMeta(label, value) {
  return `
    <div class="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</p>
      <p class="mt-1 text-sm font-bold text-slate-950">${escapeHtml(value)}</p>
    </div>
  `;
}

function bindGallery() {
  const preview = detail.querySelector("[data-cover-preview]");
  const counter = detail.querySelector("[data-gallery-counter]");
  let activeIndex = 0;

  clearInterval(galleryTimer);

  function showCover(index) {
    if (!preview || currentGallery.length < 2) return;

    activeIndex = (index + currentGallery.length) % currentGallery.length;
    preview.setAttribute("src", currentGallery[activeIndex]);
    if (counter) counter.textContent = `${activeIndex + 1}/${currentGallery.length}`;
  }

  detail.querySelectorAll("[data-gallery-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = Number(button.getAttribute("data-gallery-dir"));
      showCover(activeIndex + direction);
      clearInterval(galleryTimer);
      galleryTimer = setInterval(() => showCover(activeIndex + 1), 2000);
    });
  });

  if (currentGallery.length > 1) {
    galleryTimer = setInterval(() => showCover(activeIndex + 1), 2000);
  }
}

function renderNotFound() {
  detail.innerHTML = `
    <div class="rounded-md border border-dashed border-slate-300 px-6 py-16 text-center">
      <h1 class="text-2xl font-bold text-slate-950">Buku tidak ditemukan</h1>
      <p class="mt-2 text-sm text-slate-600">Periksa slug buku atau kembali ke katalog.</p>
      <a href="/" class="mt-6 inline-flex rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600">Buka Katalog</a>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
