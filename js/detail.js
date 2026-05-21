import { fetchBookBySlug } from "/js/book-service.js";

const detail = document.getElementById("book-detail");
const breadcrumbTitle = document.getElementById("breadcrumb-title");

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
  breadcrumbTitle.textContent = book.title;
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
  const gallery = book.gallery_urls.length > 1 ? book.gallery_urls : [];
  const buyUrl = book.buy_url || `mailto:editor@publion.id?subject=${encodeURIComponent(`Beli Buku: ${book.title}`)}`;
  detail.innerHTML = `
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(280px,420px)_1fr]">
      <aside>
        <div class="sticky top-24">
          <div class="overflow-hidden rounded-md bg-slate-100 shadow-sm ring-1 ring-slate-200">
            <img src="${book.cover_url}" alt="${escapeHtml(book.cover_alt)}" class="aspect-[5/8] w-full object-cover" />
          </div>
          ${
            gallery.length
              ? `<div class="mt-4 grid grid-cols-2 gap-3">${gallery
                  .map(
                    (url, index) => `
                      <button type="button" class="gallery-button overflow-hidden rounded-md border border-slate-200 bg-slate-100" data-cover-url="${url}">
                        <img src="${url}" alt="Preview cover ${index + 1} ${escapeHtml(book.title)}" class="aspect-[5/8] w-full object-cover" />
                      </button>
                    `
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      </aside>

      <article class="max-w-4xl">
        <div class="border-b border-slate-200 pb-6">
          <p class="text-sm font-semibold text-teal-700">${escapeHtml(book.category || "Umum")}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">${escapeHtml(book.title)}</h1>
          <p class="mt-3 text-base text-slate-600">Penulis: ${escapeHtml(book.author)}</p>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          ${renderMeta("Harga", book.price_label)}
          ${renderMeta("ISBN", book.isbn || "Dalam Proses Pengajuan")}
          ${renderMeta("Slug", `/${book.slug}`)}
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="${escapeHtml(buyUrl)}"
            class="inline-flex items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            Beli Buku
          </a>
          <a
            href="/"
            class="inline-flex items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Kembali ke Katalog
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
  const heroImage = detail.querySelector("aside img");
  detail.querySelectorAll(".gallery-button").forEach((button) => {
    button.addEventListener("click", () => {
      const coverUrl = button.getAttribute("data-cover-url");
      if (heroImage && coverUrl) heroImage.setAttribute("src", coverUrl);
    });
  });
}

function renderNotFound() {
  breadcrumbTitle.textContent = "Tidak ditemukan";
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
