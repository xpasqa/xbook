import { buildWhatsAppOrderLink, checkBookOrderInvoice, formatOrderAmount, formatOrderDate } from "./order-service.js";
import { isSupabaseConfigured } from "./supabase-client.js";

const form = document.getElementById("invoice-form");
const input = document.getElementById("invoice-input");
const submitButton = document.getElementById("invoice-submit");
const alertBox = document.getElementById("invoice-alert");
const result = document.getElementById("invoice-result");

initInvoiceCheck();

function initInvoiceCheck() {
  if (!isSupabaseConfigured()) {
    showAlert("warning", "Supabase belum dikonfigurasi.");
    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = true;
      element.classList.add("opacity-60");
    });
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const invoiceNo = params.get("invoice");
  if (invoiceNo) {
    input.value = invoiceNo.replace(/\D/g, "").slice(0, 8);
    lookupInvoice(input.value);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    lookupInvoice(input.value);
  });
}

async function lookupInvoice(value) {
  const invoiceNo = String(value || "").replace(/\D/g, "").slice(0, 8);
  input.value = invoiceNo;

  if (invoiceNo.length !== 8) {
    showAlert("error", "Nomor invoice harus 8 digit angka.");
    result.classList.add("hidden");
    return;
  }

  setLoading(true);
  showAlert("neutral", "Mencari invoice...");

  try {
    const order = await checkBookOrderInvoice(invoiceNo);
    if (!order) {
      showAlert("error", "Invoice tidak ditemukan.");
      result.classList.add("hidden");
      result.innerHTML = "";
      return;
    }

    showAlert("success", "Invoice ditemukan.");
    renderInvoice(order);
    window.history.replaceState({}, "", `${window.location.pathname}?invoice=${invoiceNo}`);
  } catch (error) {
    showAlert("error", error.message || "Gagal mengecek invoice.");
    result.classList.add("hidden");
  } finally {
    setLoading(false);
  }
}

function renderInvoice(order) {
  const totalAmount = Number(order.total_amount || 0) || Number(order.book_price || 0) + Number(order.shipping_cost || 0);
  result.classList.remove("hidden");
  result.innerHTML = `
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</p>
        <h2 class="mt-1 text-2xl font-bold text-slate-950">${escapeHtml(order.invoice_no)}</h2>
      </div>
      <span class="w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}">${formatStatus(order.status)}</span>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      ${renderInfo("Buku", order.book_title)}
      ${renderInfo("Penulis", order.book_author)}
      ${renderInfo("Ongkir", `${formatOrderAmount(order.shipping_cost)} (${order.province || "-"})`)}
      ${renderInfo("Total transfer", formatOrderAmount(totalAmount))}
      ${renderInfo("Tanggal order", formatOrderDate(order.created_at))}
      ${renderInfo("Bukti transfer", order.transfer_proof_uploaded ? "Sudah diupload" : "Belum diupload")}
    </div>

    <a
      href="${buildWhatsAppOrderLink(order)}"
      target="_blank"
      rel="noopener"
      class="mt-5 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
    >
      Konfirmasi ke WhatsApp
    </a>
  `;
}

function renderInfo(label, value) {
  return `
    <div class="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</p>
      <p class="mt-1 text-sm font-bold text-slate-950">${escapeHtml(value || "-")}</p>
    </div>
  `;
}

function getStatusClass(status) {
  const styles = {
    unpaid: "bg-amber-50 text-amber-700",
    packed: "bg-indigo-50 text-indigo-700",
    shipped: "bg-purple-50 text-purple-700",
    completed: "bg-slate-100 text-slate-700",
  };

  return styles[normalizeStatus(status)] || styles.unpaid;
}

function formatStatus(status) {
  const labels = {
    unpaid: "Belum Bayar",
    packed: "Dikemas",
    shipped: "Dikirim",
    completed: "Selesai",
  };

  return labels[normalizeStatus(status)] || "Belum Bayar";
}

function normalizeStatus(status) {
  const legacyMap = {
    waiting_payment: "unpaid",
    proof_uploaded: "unpaid",
    paid: "packed",
    processing: "packed",
    shipped: "shipped",
    completed: "completed",
  };

  return legacyMap[status] || status || "unpaid";
}

function showAlert(type, message) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  alertBox.className = `mt-5 rounded-md border px-4 py-3 text-sm ${styles[type] || styles.neutral}`;
  alertBox.textContent = message;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("opacity-60", isLoading);
  submitButton.textContent = isLoading ? "Mencari..." : "Cek Invoice";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
