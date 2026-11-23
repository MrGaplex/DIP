const HALAMAN_TUJUAN = "../Admin/admin.html";

function tampilkanError(pesan) {
  const el = document.getElementById("loginError");
  if (el) {
    el.textContent = pesan;
    el.style.display = "block";
  } else {
    alert(pesan);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  // Kalau sesi masih aktif, langsung ke dashboard
  const { data } = await sb.auth.getSession();
  if (data.session) {
    window.location.href = HALAMAN_TUJUAN;
    return;
  }

  // --- Password toggle ---
  const toggleBtn = document.querySelector(".password-toggle");
  const passwordInput = document.getElementById("password");
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", function () {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
    });
  }

  // --- Form login ---
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const tombol = loginForm.querySelector("button[type='submit'], .btn-primary");

    if (tombol) tombol.disabled = true;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (tombol) tombol.disabled = false;

    if (error) {
      tampilkanError("Login gagal: " + error.message);
      return;
    }
    window.location.href = HALAMAN_TUJUAN;
  });
});