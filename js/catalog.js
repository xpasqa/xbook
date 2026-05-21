import { fetchPublishedBooks } from "/js/book-service.js";

const state = {
  books: [],
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
  state.filters.category = params.get("category") || "";
  state.filters.price = params.get("price") || "";
  state.filters.sort = params.get("sort") || "latest";
}

function renderCategories() {
  const categories = [...new Set(state.books.map((book) => book.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id")
  );

  categoryFilter.innerHTML = `<option value="">Semua kategori</option>${categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
}

function bindFilters() {
  searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    updateQueryString();
    renderCatalog();
  });

  categoryFilter.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    updateQueryString();
    renderCatalog();
  });

  priceFilter.addEventListener("change", (event) => {
    state.filters.price = event.target.value;
    updateQueryString();
    renderCatalog();
  });

  sortFilter.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    updateQueryString();
    renderCatalog();
  });
}

function syncFilterControls() {
  searchInput.value = state.filters.search;
  categoryFilter.value = state.filters.category;
  priceFilter.value = state.filters.price;
  sortFilter.value = state.filters.sort;
}

function updateQueryString() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set("q", state.filters.search);
  if (state.filters.category) params.set("category", state.filters.category);
  if (state.filters.price) params.set("price", state.filters.price);
  if (state.filters.sort && state.filters.sort !== "latest") params.set("sort", state.filters.sort);

  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", url);
}

function renderCatalog() {
  const visibleBooks = getFilteredBooks();
  count.textContent = `Menampilkan ${visibleBooks.length} dari ${state.books.length} buku`;
  emptyState.classList.toggle("hidden", visibleBooks.length !== 0);

  grid.innerHTML = visibleBooks.map(renderBookCard).join("");
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
    <article class="group">
      <a href="${detailUrl}" class="block overflow-hidden rounded-md bg-slate-100 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <img src="${book.cover_url}" alt="${escapeHtml(book.cover_alt)}" class="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
      </a>
      <div class="pt-3">
        <a href="${detailUrl}" class="line-clamp-2 text-sm font-bold leading-5 text-slate-950 hover:text-teal-700">${escapeHtml(book.title)}</a>
        <p class="mt-1 line-clamp-1 text-xs text-slate-500">${escapeHtml(book.author)}</p>
        <p class="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">${escapeHtml(book.short_description || "")}</p>
        <div class="mt-3 flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-slate-950">${book.price_label}</span>
          <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">${escapeHtml(book.category || "Umum")}</span>
        </div>
      </div>
    </article>
  `;
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
