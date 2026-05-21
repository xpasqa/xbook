import { getCurrentSession, getSupabase, isSupabaseConfigured } from "/js/supabase-client.js";

const form = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const alertBox = document.getElementById("auth-alert");

initAuth();

async function initAuth() {
  if (!isSupabaseConfigured()) {
    showAlert("warning", "Isi js/supabase-config.js dengan SUPABASE_URL dan ANON_KEY sebelum login digunakan.");
    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = true;
      element.classList.add("opacity-60");
    });
    return;
  }

  const session = await getCurrentSession();
  if (session) window.location.href = "/dashboard.html";

  form.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const supabase = await getSupabase();

  setLoading(true);
  showAlert("neutral", "Memproses login...");

  const result = await supabase.auth.signInWithPassword({ email, password });

  setLoading(false);

  if (result.error) {
    showAlert("error", result.error.message);
    return;
  }

  window.location.href = "/dashboard.html";
}

function setLoading(isLoading) {
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = isLoading;
    element.classList.toggle("opacity-60", isLoading);
  });
}

function showAlert(type, message) {
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  alertBox.className = `mt-5 rounded-md border px-4 py-3 text-sm ${styles[type] || styles.neutral}`;
  alertBox.textContent = message;
}
