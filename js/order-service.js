import { getSupabase } from "./supabase-client.js";

const WHATSAPP_NUMBER = "6285117666549";

export function generateInvoiceNo() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export async function createBookOrder(payload) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const orderToken = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : generateFallbackUuid();
  const order = {
    ...payload,
    order_token: orderToken,
    status: "unpaid",
  };

  const { error } = await supabase.from("book_orders").insert(order);

  if (error) throw error;
  return order;
}

export async function fetchBookOrders() {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase.from("book_orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function checkBookOrderInvoice(invoiceNo) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase.rpc("check_book_order_invoice", {
    p_invoice_no: String(invoiceNo || "").trim(),
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function uploadTransferProof(file, invoiceNo) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  if (!file) throw new Error("Pilih file bukti transfer dulu.");

  const extension = file.name.split(".").pop() || "jpg";
  const fileName = `${sanitizeFileName(invoiceNo)}/proof-${Date.now()}.${extension.toLowerCase()}`;
  const { error } = await supabase.storage.from("transfer-proofs").upload(fileName, file, {
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("transfer-proofs").getPublicUrl(fileName);
  return data.publicUrl;
}

export async function attachTransferProof(invoiceNo, orderToken, transferProofUrl) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.rpc("attach_order_transfer_proof", {
    p_invoice_no: invoiceNo,
    p_order_token: orderToken,
    p_transfer_proof_url: transferProofUrl,
  });

  if (error) throw error;
}

export async function updateBookOrderStatus(invoiceNo, status) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.from("book_orders").update({ status }).eq("invoice_no", invoiceNo);
  if (error) throw error;
}

export function buildWhatsAppOrderLink(order, transferProofUrl = "") {
  const proofLine = transferProofUrl || order.transfer_proof_url ? `\nBukti transfer: ${transferProofUrl || order.transfer_proof_url}` : "";
  const message = [
    "Halo Publion, saya ingin konfirmasi order buku.",
    "",
    `Invoice: ${order.invoice_no}`,
    `Buku: ${order.book_title}`,
    order.book_author ? `Penulis: ${order.book_author}` : "",
    `Harga buku: ${order.price_label || formatOrderAmount(order.book_price)}`,
    `Ongkir: ${formatOrderAmount(order.shipping_cost)} (${order.province || "-"})`,
    `Total transfer: ${formatOrderAmount(order.total_amount || Number(order.book_price || 0) + Number(order.shipping_cost || 0))}`,
    order.customer_name ? `Nama: ${order.customer_name}` : "",
    order.phone ? `No. Telp: ${order.phone}` : "",
    order.email ? `Email: ${order.email}` : "",
    order.shipping_address ? `Alamat kirim: ${order.shipping_address}` : "",
    order.city ? `Kota: ${order.city}` : "",
    order.province ? `Provinsi: ${order.province}` : "",
    proofLine,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function formatOrderAmount(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatOrderDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sanitizeFileName(value) {
  return String(value || "order")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateFallbackUuid() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
    (Number(character) ^ (Math.random() * 16) >> (Number(character) / 4)).toString(16)
  );
}
