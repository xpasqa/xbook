import { formatRupiah, sampleBooks } from "/js/books-data.js";
import { getSupabase, isSupabaseConfigured } from "/js/supabase-client.js";

export function normalizeBook(book) {
  const gallery = Array.isArray(book.gallery_urls) && book.gallery_urls.length > 0 ? book.gallery_urls : [book.cover_url];
  return {
    ...book,
    price: Number(book.price || 0),
    price_label: book.price_label || formatRupiah(book.price),
    keywords: Array.isArray(book.keywords) ? book.keywords : [],
    gallery_urls: gallery.filter(Boolean),
    cover_alt: book.cover_alt || `Cover buku ${book.title}`,
  };
}

export async function fetchPublishedBooks() {
  const supabase = await getSupabase();
  const localBooks = sampleBooks.map(normalizeBook);

  if (!supabase) {
    return {
      books: localBooks,
      source: "sample",
      message: "",
    };
  }

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Gagal membaca buku dari Supabase:", error.message);
    return {
      books: localBooks,
      source: "fallback",
      message: "",
    };
  }

  const mergedBooks = new Map(localBooks.map((book) => [book.slug, book]));
  for (const book of data || []) {
    mergedBooks.set(book.slug, normalizeBook(book));
  }

  return {
    books: [...mergedBooks.values()],
    source: "supabase",
    message: "",
  };
}

export async function fetchBookBySlug(slug) {
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from("books").select("*").eq("slug", slug).maybeSingle();
    if (!error && data) {
      return { book: normalizeBook(data), source: "supabase" };
    }
    if (error) console.warn("Gagal membaca detail buku dari Supabase:", error.message);
  }

  const book = sampleBooks.find((item) => item.slug === slug);
  return { book: book ? normalizeBook(book) : null, source: isSupabaseConfigured() ? "fallback" : "sample" };
}

export async function fetchAdminBooks() {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase.from("books").select("*").order("updated_at", { ascending: false });
  if (error) throw error;

  return (data || []).map(normalizeBook);
}

export async function createBook(payload) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from("books")
    .insert({ ...payload, created_by: user?.id })
    .select("*")
    .single();
  if (error) throw error;

  return normalizeBook(data);
}

export async function updateBook(id, payload) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase.from("books").update(payload).eq("id", id).select("*").single();
  if (error) throw error;

  return normalizeBook(data);
}

export async function uploadCover(file, slug, side = "cover") {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  if (!file) return "";

  const extension = file.name.split(".").pop() || "jpg";
  const safeName = `${slug}/${side}-${Date.now()}.${extension.toLowerCase()}`;
  const { error } = await supabase.storage.from("book-covers").upload(safeName, file, {
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("book-covers").getPublicUrl(safeName);
  return data.publicUrl;
}
