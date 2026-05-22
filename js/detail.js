import { fetchBookBySlug } from "./book-service.js";
import {
  attachTransferProof,
  buildWhatsAppOrderLink,
  createBookOrder,
  formatOrderAmount,
  generateInvoiceNo,
  uploadTransferProof,
} from "./order-service.js";
import { getShippingRateByProvince, shippingRates } from "./shipping-rates.js";

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
          <button
            type="button"
            data-open-order
            class="inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
          >
            Beli Buku
          </button>
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

    ${renderOrderModal(book)}
  `;

  bindGallery();
  bindOrderModal(book);
}

function renderOrderModal(book) {
  const bookPrice = Number(book.price || 0);
  return `
    <div id="order-modal" class="fixed inset-0 z-50 hidden items-center justify-center px-4 py-6" aria-hidden="true">
      <button type="button" data-close-order class="absolute inset-0 cursor-default bg-slate-950/60" aria-label="Tutup modal order"></button>
      <div class="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 class="text-lg font-bold text-slate-950">Order Buku</h2>
          </div>
          <button type="button" data-close-order class="rounded-md px-2 py-1 text-xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950" aria-label="Tutup modal">&times;</button>
        </div>

        <div class="px-5 py-5">
          <div data-order-alert class="mb-4 hidden rounded-md border px-4 py-3 text-sm"></div>

          <form id="order-form" class="grid grid-cols-1 gap-4">
            <div class="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Buku</p>
              <p class="mt-1 text-sm font-bold text-slate-950">${escapeHtml(book.title)}</p>
              <p class="mt-1 text-sm text-slate-600">${escapeHtml(book.author)}</p>
              <div class="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
                <div class="flex items-center justify-between gap-4">
                  <span class="text-slate-500">Harga buku</span>
                  <span class="font-semibold text-slate-950">${escapeHtml(book.price_label)}</span>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <span class="text-slate-500">Ongkir reguler 1 Kg</span>
                  <span data-shipping-label class="font-semibold text-slate-950">Pilih provinsi</span>
                </div>
                <div class="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
                  <span class="font-semibold text-slate-950">Total bayar</span>
                  <span data-total-label class="text-base font-bold text-slate-950">${formatOrderAmount(bookPrice)}</span>
                </div>
              </div>
            </div>

            <label class="block">
              <span class="text-sm font-semibold text-slate-700">Nama pemesan</span>
              <input name="customer_name" required class="order-input" placeholder="Nama lengkap" />
            </label>

            <label class="block">
              <span class="text-sm font-semibold text-slate-700">Alamat kirim</span>
              <textarea name="shipping_address" required rows="4" class="order-textarea" placeholder="Alamat lengkap pengiriman"></textarea>
            </label>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-semibold text-slate-700">Kota</span>
                <input name="city" required class="order-input" placeholder="Nama kota" />
              </label>

              <label class="block">
                <span class="text-sm font-semibold text-slate-700">Provinsi</span>
                <select name="province" required class="order-input" data-province-select>
                  <option value="">Pilih provinsi</option>
                  ${shippingRates
                    .map(
                      (rate) =>
                        `<option value="${escapeHtml(rate.province)}">${escapeHtml(rate.province)}</option>`
                    )
                    .join("")}
                </select>
              </label>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-semibold text-slate-700">No. telp</span>
                <input name="phone" required class="order-input" placeholder="08..." />
              </label>

              <label class="block">
                <span class="text-sm font-semibold text-slate-700">Email</span>
                <input name="email" type="email" required class="order-input" placeholder="email@domain.com" />
              </label>
            </div>

            <button type="submit" id="create-order-button" class="inline-flex w-full items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600">
              Beli Buku
            </button>
          </form>

          <div id="order-payment" class="hidden">
            <div class="rounded-md border border-slate-200 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</p>
              <p id="order-invoice" class="mt-1 text-xl font-bold text-slate-950"></p>
              <a id="order-check-link" href="/cek-invoice.html" class="mt-2 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900">Cek status invoice</a>
              <div class="mt-4 rounded-md bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                <div class="flex items-center justify-between gap-4">
                  <span class="text-slate-500">Harga buku</span>
                  <span data-payment-book-price class="font-semibold text-slate-950">${escapeHtml(book.price_label)}</span>
                </div>
                <div class="mt-2 flex items-center justify-between gap-4">
                  <span class="text-slate-500">Ongkir</span>
                  <span data-payment-shipping class="font-semibold text-slate-950">-</span>
                </div>
                <div class="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
                  <span class="font-semibold text-slate-950">Total transfer</span>
                  <span data-payment-total class="text-base font-bold text-slate-950">${formatOrderAmount(bookPrice)}</span>
                </div>
              </div>
              <p class="mt-4 text-sm leading-6 text-slate-700">
                Silakan transfer ke rekening:
              </p>
              <div class="mt-3 rounded-md bg-orange-500 p-4 text-white">
                <p class="text-xs font-semibold uppercase tracking-wide text-orange-100">BNI</p>
                <p class="mt-1 text-2xl font-bold tracking-wide">1887044305</p>
                <p class="mt-1 text-sm text-slate-200">PT Publion Research Ventures</p>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input id="transfer-proof-file" type="file" accept="image/*,application/pdf" class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-teal-600" />
              <button id="upload-proof-button" type="button" class="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                Upload Bukti Transfer
              </button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a id="order-whatsapp-link" href="https://wa.me/6285117666549" target="_blank" rel="noopener" class="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                Konfirmasi ke WhatsApp
              </a>
              <button type="button" data-close-order class="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
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

function bindOrderModal(book) {
  const modal = detail.querySelector("#order-modal");
  const openButton = detail.querySelector("[data-open-order]");
  const form = detail.querySelector("#order-form");
  const payment = detail.querySelector("#order-payment");
  const alertBox = detail.querySelector("[data-order-alert]");
  const createButton = detail.querySelector("#create-order-button");
  const invoiceLabel = detail.querySelector("#order-invoice");
  const proofInput = detail.querySelector("#transfer-proof-file");
  const proofButton = detail.querySelector("#upload-proof-button");
  const whatsappLink = detail.querySelector("#order-whatsapp-link");
  const provinceSelect = detail.querySelector("[data-province-select]");
  const shippingLabel = detail.querySelector("[data-shipping-label]");
  const totalLabel = detail.querySelector("[data-total-label]");
  const paymentShipping = detail.querySelector("[data-payment-shipping]");
  const paymentTotal = detail.querySelector("[data-payment-total]");
  const orderCheckLink = detail.querySelector("#order-check-link");
  const bookPrice = Number(book.price || 0);
  let activeOrder = null;

  if (!modal || !openButton || !form) return;

  openButton.addEventListener("click", () => {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("aria-hidden", "false");
  });

  modal.querySelectorAll("[data-close-order]").forEach((button) => {
    button.addEventListener("click", () => closeOrderModal(modal));
  });

  provinceSelect?.addEventListener("change", () => {
    const rate = getShippingRateByProvince(provinceSelect.value);
    const shippingCost = rate?.cost || 0;
    const totalAmount = bookPrice + shippingCost;

    if (shippingLabel) {
      shippingLabel.textContent = rate ? formatOrderAmount(rate.cost) : "Pilih provinsi";
    }
    if (totalLabel) totalLabel.textContent = formatOrderAmount(totalAmount);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const invoiceNo = generateInvoiceNo();
    const province = String(formData.get("province") || "").trim();
    const shippingRate = getShippingRateByProvince(province);

    if (!shippingRate) {
      showOrderAlert(alertBox, "error", "Pilih provinsi tujuan dulu untuk menghitung ongkir.");
      return;
    }

    const totalAmount = bookPrice + shippingRate.cost;

    setOrderLoading(createButton, true, "Memproses...");
    showOrderAlert(alertBox, "neutral", "Memproses order buku...");

    try {
      activeOrder = await createBookOrder({
        invoice_no: invoiceNo,
        book_slug: book.slug,
        book_title: book.title,
        book_author: book.author,
        book_price: bookPrice,
        price_label: book.price_label || "",
        customer_name: String(formData.get("customer_name") || "").trim(),
        shipping_address: String(formData.get("shipping_address") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        province,
        shipping_destination_city: shippingRate.destinationCity,
        shipping_cost: shippingRate.cost,
        total_amount: totalAmount,
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
      });

      form.classList.add("hidden");
      payment?.classList.remove("hidden");
      if (invoiceLabel) invoiceLabel.textContent = activeOrder.invoice_no;
      if (paymentShipping) paymentShipping.textContent = `${formatOrderAmount(activeOrder.shipping_cost)} (${activeOrder.province})`;
      if (paymentTotal) paymentTotal.textContent = formatOrderAmount(activeOrder.total_amount);
      if (orderCheckLink) orderCheckLink.href = `/cek-invoice.html?invoice=${activeOrder.invoice_no}`;
      if (whatsappLink) whatsappLink.href = buildWhatsAppOrderLink(activeOrder);
      showOrderAlert(alertBox, "success", "Invoice berhasil dibuat. Silakan transfer sesuai instruksi.");
    } catch (error) {
      showOrderAlert(alertBox, "error", error.message || "Gagal membuat order.");
    } finally {
      setOrderLoading(createButton, false, "Beli Buku");
    }
  });

  proofButton?.addEventListener("click", async () => {
    if (!activeOrder) {
      showOrderAlert(alertBox, "error", "Buat invoice dulu sebelum upload bukti transfer.");
      return;
    }

    const file = proofInput?.files?.[0];
    if (!file) {
      showOrderAlert(alertBox, "error", "Pilih file bukti transfer dulu.");
      return;
    }

    setOrderLoading(proofButton, true, "Mengupload...");
    showOrderAlert(alertBox, "neutral", "Mengupload bukti transfer...");

    try {
      const transferProofUrl = await uploadTransferProof(file, activeOrder.invoice_no);
      await attachTransferProof(activeOrder.invoice_no, activeOrder.order_token, transferProofUrl);
      activeOrder = { ...activeOrder, transfer_proof_url: transferProofUrl };
      if (whatsappLink) whatsappLink.href = buildWhatsAppOrderLink(activeOrder, transferProofUrl);
      showOrderAlert(alertBox, "success", "Bukti transfer berhasil diupload. Lanjutkan konfirmasi ke WhatsApp.");
    } catch (error) {
      showOrderAlert(alertBox, "error", error.message || "Gagal upload bukti transfer.");
    } finally {
      setOrderLoading(proofButton, false, "Upload Bukti Transfer");
    }
  });
}

function closeOrderModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  modal.setAttribute("aria-hidden", "true");
}

function showOrderAlert(alertBox, type, message) {
  if (!alertBox) return;
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  alertBox.className = `mb-4 rounded-md border px-4 py-3 text-sm ${styles[type] || styles.neutral}`;
  alertBox.textContent = message;
}

function setOrderLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle("opacity-60", isLoading);
  button.textContent = label;
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
