import { getCurrentSession, getSupabase, isSupabaseConfigured } from "/js/supabase-client.js";

const navItems = [
  { href: "https://publion.org/", label: "Home", key: "home" },
  { href: "https://publion.org/about.html", label: "About", key: "about" },
  { href: "https://publion.org/journals.html", label: "Journal", key: "journal" },
  { href: "/", label: "Book", key: "catalog" },
  { href: "mailto:editor@publion.id", label: "Contact", key: "contact" },
];

export function renderLayout(activeKey = "catalog") {
  renderHeader(activeKey);
  renderFooter();
}

async function renderHeader(activeKey) {
  const header = document.getElementById("site-header");
  if (!header) return;

  header.innerHTML = `
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" class="text-base font-bold tracking-tight text-slate-950 sm:text-lg">Publion Books</a>
        <nav class="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          ${navItems
            .map(
              (item) => `
                <a href="${item.href}" class="rounded-md px-3 py-2 text-sm font-medium transition ${
                activeKey === item.key
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }">${item.label}</a>
              `
            )
            .join("")}
        </nav>
        <div id="auth-actions" class="flex items-center gap-2">
          <a href="/login.html" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">Login</a>
          <a href="/login.html?mode=register" class="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-600">Register</a>
        </div>
      </div>
    </header>
  `;

  if (!isSupabaseConfigured()) return;

  const session = await getCurrentSession();
  const actions = document.getElementById("auth-actions");
  if (!actions || !session) return;

  actions.innerHTML = `
    <span class="hidden max-w-48 truncate text-xs text-slate-500 sm:inline">${session.user.email}</span>
    <button id="logout-button" type="button" class="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">Logout</button>
  `;

  document.getElementById("logout-button")?.addEventListener("click", async () => {
    const supabase = await getSupabase();
    await supabase?.auth.signOut();
    window.location.href = "/";
  });
}

function renderFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  footer.innerHTML = `
    <footer class="mt-12 border-t border-slate-200 bg-slate-950 text-white">
      <div class="mx-auto grid max-w-screen-2xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h2 class="text-lg font-bold">Publion Research</h2>
          <p class="mt-3 max-w-sm text-sm leading-6 text-slate-300">Empowering knowledge through accessible and impactful research publications.</p>
        </div>
        <div>
          <h3 class="text-sm font-semibold">Navigasi</h3>
          <div class="mt-3 grid gap-2 text-sm text-slate-300">
            <a href="https://publion.org/" class="hover:text-white">Home</a>
            <a href="https://publion.org/about.html" class="hover:text-white">About</a>
            <a href="https://publion.org/journals.html" class="hover:text-white">Journal</a>
            <a href="/" class="hover:text-white">Book</a>
            <a href="mailto:editor@publion.id" class="hover:text-white">Contact</a>
            <a href="/login.html" class="hover:text-white">Login</a>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-semibold">Kontak</h3>
          <div class="mt-3 space-y-1 text-sm text-slate-300">
            <p>Email: editor@publion.id</p>
            <p>Domain: book.publion.org</p>
          </div>
        </div>
      </div>
      <div class="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-400">© 2026 PT Publion Research Ventures. All rights reserved.</div>
    </footer>
  `;
}
