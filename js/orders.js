import { buildWhatsAppOrderLink, fetchBookOrders, formatOrderDate, updateBookOrderStatus } from "./order-service.js";
import { getCurrentSession, isSupabaseConfigured } from "./supabase-client.js";

const alertBox = document.getElementById("orders-alert");
const count = document.getElementById("orders-count");
const table = document.getElementById("orders-table");

const orderStatuses = [
  { value: "unpaid", label: "Belum Bayar" },
  { value: "packed", label: "Dikemas" },
  { value: "shipped", label: "Dikirim" },
  { value: "completed", label: "Selesai" },
];

initOrders();

async function initOrders() {
  if (!isSupabaseConfigured()) {
    showAlert("warning", "Isi js/supabase-config.js sebelum halaman order digunakan.");
    table.innerHTML = tableMessage("Supabase belum dikonfigurasi.");
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  table.addEventListener("change", handleStatusChange);
  await renderOrders();
}

async function renderOrders() {
  try {
    const orders = await fetchBookOrders();
    count.textContent = `${orders.length} order`;
    table.innerHTML = orders.length ? orders.map(renderOrderRow).join("") : tableMessage("Belum ada order buku.");
  } catch (error) {
    table.innerHTML = tableMessage(error.message || "Gagal membaca order buku.");
  }
}

function renderOrderRow(order) {
  const totalAmount = Number(order.total_amount || 0) || Number(order.book_price || 0) + Number(order.shipping_cost || 0);
  const proofLink = order.transfer_proof_url
    ? `<a href="${escapeHtml(order.transfer_proof_url)}" target="_blank" rel="noopener" class="font-semibold text-teal-700 hover:text-teal-900">Lihat</a>`
    : `<span class="text-slate-400">Belum ada</span>`;

  return `
    <tr>
      <td class="px-5 py-4 align-top">
        <div class="font-semibold text-slate-950">${escapeHtml(order.invoice_no)}</div>
        <div class="mt-1 text-xs text-slate-500">${formatOrderDate(order.created_at)}</div>
      </td>
      <td class="px-5 py-4 align-top">
        <div class="font-semibold text-slate-950">${escapeHtml(order.book_title)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(order.book_author)}</div>
        <div class="mt-1 text-xs text-slate-500">Buku: ${escapeHtml(order.price_label || formatOrderCurrency(order.book_price))}</div>
        <div class="mt-1 text-xs text-slate-500">Ongkir: ${escapeHtml(formatOrderCurrency(order.shipping_cost))}</div>
        <div class="mt-1 text-xs font-semibold text-slate-700">Total: ${escapeHtml(formatOrderCurrency(totalAmount))}</div>
      </td>
      <td class="px-5 py-4 align-top">
        <div class="font-semibold text-slate-950">${escapeHtml(order.customer_name)}</div>
        <div class="mt-1 max-w-xs text-xs leading-5 text-slate-500">${escapeHtml(order.shipping_address)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml([order.city, order.province].filter(Boolean).join(", "))}</div>
      </td>
      <td class="px-5 py-4 align-top">
        <div>${escapeHtml(order.phone)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(order.email)}</div>
      </td>
      <td class="px-5 py-4 align-top">
        <select data-order-status="${escapeHtml(order.invoice_no)}" class="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200">
          ${orderStatuses
            .map(
              (status) =>
                `<option value="${status.value}" ${status.value === normalizeStatus(order.status) ? "selected" : ""}>${status.label}</option>`
            )
            .join("")}
        </select>
      </td>
      <td class="px-5 py-4 text-right align-top">${proofLink}</td>
      <td class="px-5 py-4 text-right align-top">
        <a href="${buildWhatsAppOrderLink(order)}" target="_blank" rel="noopener" class="font-semibold text-emerald-700 hover:text-emerald-900">Konfirmasi</a>
      </td>
    </tr>
  `;
}

async function handleStatusChange(event) {
  const select = event.target.closest("[data-order-status]");
  if (!select) return;

  const invoiceNo = select.dataset.orderStatus;
  select.disabled = true;

  try {
    await updateBookOrderStatus(invoiceNo, select.value);
  } catch (error) {
    showAlert("warning", error.message || "Gagal mengubah status order.");
    await renderOrders();
  } finally {
    select.disabled = false;
  }
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

function formatOrderCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function tableMessage(message) {
  return `
    <tr>
      <td class="px-5 py-6 text-sm text-slate-600" colspan="7">${escapeHtml(message)}</td>
    </tr>
  `;
}

function showAlert(type, message) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };

  alertBox.className = `mb-6 rounded-md border px-4 py-3 text-sm ${styles[type] || styles.warning}`;
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
