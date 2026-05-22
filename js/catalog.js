import { fetchPublishedBooks } from "./book-service.js";

const state = {
  books: [],
  page: 1,
  perPage: 10,
  filters: {
    search: "",
    category: "",
    price: "",
    sort: "latest",
  },
};

const grid = document.getElementById("book-grid");
const count = document.getElementById("catalog-count");
const source = document.getElementById("catalog-source");
const emptyState = document.getElementById("empty-state");
const pagination = document.getElementById("catalog-pagination");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const priceFilter = document.getElementById("price-filter");
const sortFilter = document.getElementById("sort-filter");

initCatalog();

async function initCatalog() {
  applyQueryFilters();

  const result = await fetchPublishedBooks();
  state.books = result.books;
  source.textContent = result.message || "";

  renderCategories();
  syncFilterControls();
  bindFilters();
  renderCatalog();
}

function applyQueryFilters() {
  const params = new URLSearchParams(window.location.search);
  state.filters.search = (params.get("q") || "").trim().toLowerCase();
  state.filters.category = categoryFilter ? params.get("category") || "" : "";
  state.filters.price = priceFilter ? params.get("price") || "" : "";
  state.filters.sort = sortFilter ? params.get("sort") || "latest" : "latest";
}

function renderCategories() {
  if (!categoryFilter) return;

  const categories = [...new Set(state.books.map((book) => book.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id")
  );

  categoryFilter.innerHTML = `<option value="">Semua kategori</option>${categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
}

function bindFilters() {
  searchInput?.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    state.page = 1;
    updateQueryString();
    renderCatalog();
  });

  categoryFilter?.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    state.page = 1;
    updateQueryString();
    renderCatalog();
  });

  priceFilter?.addEventListener("change", (event) => {
    state.filters.price = event.target.value;
    state.page = 1;
    updateQueryString();
    renderCatalog();
  });

  sortFilter?.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    state.page = 1;
    updateQueryString();
    renderCatalog();
  });

  pagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;

    state.page = Number(button.dataset.page);
    renderCatalog();
  });
}

function syncFilterControls() {
  if (searchInput) searchInput.value = state.filters.search;
  if (categoryFilter) categoryFilter.value = state.filters.category;
  if (priceFilter) priceFilter.value = state.filters.price;
  if (sortFilter) sortFilter.value = state.filters.sort;
}

function updateQueryString() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set("q", state.filters.search);
  if (categoryFilter && state.filters.category) params.set("category", state.filters.category);
  if (priceFilter && state.filters.price) params.set("price", state.filters.price);
  if (sortFilter && state.filters.sort && state.filters.sort !== "latest") params.set("sort", state.filters.sort);

  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", url);
}

function renderCatalog() {
  const visibleBooks = getFilteredBooks();
  const pageCount = Math.max(1, Math.ceil(visibleBooks.length / state.perPage));
  state.page = Math.min(state.page, pageCount);

  const start = (state.page - 1) * state.perPage;
  const paginatedBooks = visibleBooks.slice(start, start + state.perPage);
  const firstItem = visibleBooks.length ? start + 1 : 0;
  const lastItem = start + paginatedBooks.length;

  count.textContent = `Menampilkan ${firstItem}-${lastItem} dari ${visibleBooks.length} buku`;
  emptyState.classList.toggle("hidden", visibleBooks.length !== 0);
  pagination?.classList.toggle("hidden", pageCount <= 1);

  grid.innerHTML = paginatedBooks.map(renderBookCard).join("");
  renderPagination(pageCount);
}

function getFilteredBooks() {
  return state.books
    .filter((book) => {
      const haystack = [book.title, book.author, book.category, book.short_description, ...(book.keywords || [])]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !state.filters.search || haystack.includes(state.filters.search);
      const matchesCategory = !state.filters.category || book.category === state.filters.category;
      const matchesPrice = matchesPriceRange(book.price, state.filters.price);
      return matchesSearch && matchesCategory && matchesPrice;
    })
    .sort(sortBooks);
}

function matchesPriceRange(price, range) {
  if (!range) return true;
  if (range === "under-100000") return price < 100000;
  if (range === "100000-150000") return price >= 100000 && price <= 150000;
  if (range === "over-150000") return price > 150000;
  return true;
}

function sortBooks(a, b) {
  if (state.filters.sort === "title") return a.title.localeCompare(b.title, "id");
  if (state.filters.sort === "price-asc") return a.price - b.price;
  if (state.filters.sort === "price-desc") return b.price - a.price;
  return (a.sort_order || 999) - (b.sort_order || 999);
}

function renderBookCard(book) {
  const detailUrl = getBookUrl(book.slug);
  return `
    <article class="group overflow-hidden rounded-lg bg-slate-50 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <a href="${detailUrl}" class="block overflow-hidden bg-slate-100">
        <img src="${book.cover_url}" alt="${escapeHtml(book.cover_alt)}" class="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
      </a>
      <div class="p-3 sm:p-4">
        <a href="${detailUrl}" class="line-clamp-2 text-xs font-bold leading-4 text-slate-950 hover:text-teal-700 sm:text-sm sm:leading-5">${escapeHtml(book.title)}</a>
        <p class="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">${escapeHtml(book.author)}</p>
      </div>
    </article>
  `;
}

function renderPagination(pageCount) {
  if (!pagination) return;

  if (pageCount <= 1) {
    pagination.innerHTML = "";
    return;
  }

  pagination.innerHTML = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const isActive = page === state.page;
    return `
      <button
        type="button"
        data-page="${page}"
        class="h-9 min-w-9 rounded-md px-3 text-sm font-semibold transition ${
          isActive
            ? "bg-slate-950 text-white"
            : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        }"
      >
        ${page}
      </button>
    `;
  }).join("");
}

function getBookUrl(slug) {
  return `/${slug}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
