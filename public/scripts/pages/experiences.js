// =====================
// experiences.js
// パス: /public/scripts/pages/experiences.js
// 使用: /public/student-japan/experiences.html
// 用途: 留学体験記一覧ページ
// =====================

const path = window.location.pathname;

if (path === "/student-japan/experiences.html") {
  let currentPage = 1;
  let currentSearch = "";
  let currentCountry = "";
  let currentUserId = 0;

  async function initUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const user = await res.json();
        currentUserId = user.id || 0;
      }
    } catch {}
  }

  async function fetchExperiences() {
    const res = await fetch(
      `/api/experiences?page=${currentPage}&search=${encodeURIComponent(currentSearch)}&country=${encodeURIComponent(currentCountry)}`,
    );
    return await res.json();
  }

  async function fetchCountries() {
    const res = await fetch("/api/experiences/countries");
    return await res.json();
  }

  function renderStars(rating) {
    return "★".repeat(rating) + "☆".repeat(10 - rating);
  }

  async function renderCountryFilter() {
    const countries = await fetchCountries();
    const select = document.getElementById("country-filter");
    select.innerHTML = `
      <option value="">すべての国</option>
      ${countries.map((c) => `<option value="${c}">${c}</option>`).join("")}
    `;
    select.addEventListener("change", () => {
      currentCountry = select.value;
      currentPage = 1;
      renderExperiences();
    });
  }

  async function renderExperiences() {
    document.getElementById("experiences-list").innerHTML =
      '<li class="thread__empty">読み込み中...</li>';
    const data = await fetchExperiences();
    const totalPages = Math.ceil(data.total / data.limit);

    document.getElementById("experiences-list").innerHTML = data.experiences
      .length
      ? data.experiences
          .map(
            (e) => `
          <li class="experience__item">
            <a href="/student-japan/experience.html?id=${e.id}" class="experience__link">
              <div class="experience__header">
                <div class="experience__tags">
                  <span class="experience__tag experience__tag--country">🌏 ${e.country}</span>
                  <span class="experience__tag experience__tag--univ">🏫 ${e.university}</span>
                  ${e.major !== "匿名" ? `<span class="experience__tag">📚 ${e.major}</span>` : ""}
                </div>
                <div class="experience__rating">
                  <span class="experience__stars">${renderStars(e.rating)}</span>
                  <span class="experience__rating-num">${e.rating}/10</span>
                </div>
              </div>
              <div class="experience__author">✏️ ${e.author_name}</div>
              <div class="experience__summary">${e.summary.length > 100 ? e.summary.slice(0, 100) + "..." : e.summary}</div>
              <div class="experience__footer">
                <span class="thread__stat">👍 ${e.like_count}</span>
                <span class="thread__stat">📅 ${new Date(e.created_at).toLocaleDateString("ja-JP")}</span>
              </div>
            </a>
          </li>
        `,
          )
          .join("")
      : '<li class="thread__empty">体験記が見つかりませんでした</li>';

    document.getElementById("experiences-pagination").innerHTML =
      totalPages > 1
        ? `
      <div class="pagination">
        <button class="pagination__btn ${currentPage === 1 ? "pagination__btn--disabled" : ""}" id="exp-prev" ${currentPage === 1 ? "disabled" : ""}>← 前へ</button>
        <span class="pagination__info">${currentPage} / ${totalPages}</span>
        <button class="pagination__btn ${currentPage === totalPages ? "pagination__btn--disabled" : ""}" id="exp-next" ${currentPage === totalPages ? "disabled" : ""}>次へ →</button>
      </div>
    `
        : "";

    if (currentPage > 1) {
      document.getElementById("exp-prev")?.addEventListener("click", () => {
        currentPage--;
        renderExperiences();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    if (currentPage < totalPages) {
      document.getElementById("exp-next")?.addEventListener("click", () => {
        currentPage++;
        renderExperiences();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function initSearch() {
    const input = document.getElementById("experiences-search");
    const btn = document.getElementById("experiences-search-btn");
    btn.addEventListener("click", () => {
      currentSearch = input.value.trim();
      currentPage = 1;
      renderExperiences();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        currentSearch = input.value.trim();
        currentPage = 1;
        renderExperiences();
      }
    });
  }

  function initModal() {
    const postBtn = document.getElementById("postExpBtn");
    const modal = document.getElementById("expModal");
    const overlay = document.getElementById("expModalOverlay");
    const closeBtn = document.getElementById("expModalClose");
    const submitBtn = document.getElementById("expSubmit");

    postBtn.addEventListener("click", () => {
      if (!currentUserId) {
        alert("投稿するにはログインが必要です");
        window.location.href = "/student-japan/login.html";
        return;
      }
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    });

    function closeModal() {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }

    overlay.addEventListener("click", closeModal);
    closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    submitBtn.addEventListener("click", async () => {
      const country = document.getElementById("exp-country").value.trim();
      const university =
        document.getElementById("exp-university").value.trim() || "匿名";
      const author_name = document.getElementById("exp-author").value.trim();
      const major = document.getElementById("exp-major").value.trim() || "匿名";
      const rating = parseInt(document.getElementById("exp-rating").value);
      const summary = document.getElementById("exp-summary").value.trim();
      const good = document.getElementById("exp-good").value.trim();
      const bad = document.getElementById("exp-bad").value.trim();
      const fun = document.getElementById("exp-fun").value.trim();

      if (
        !country ||
        !author_name ||
        !rating ||
        !summary ||
        !good ||
        !bad ||
        !fun
      ) {
        alert("必須項目をすべて入力してください");
        return;
      }

      for (const [label, val] of [
        ["要約", summary],
        ["良かったこと", good],
        ["悪かったこと", bad],
        ["楽しかったこと", fun],
      ]) {
        if (val.length < 50) {
          alert(`「${label}」は50文字以上入力してください`);
          return;
        }
        if (val.length > 800) {
          alert(`「${label}」は800文字以内にしてください`);
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "送信中...";

      try {
        const res = await fetch("/api/experiences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: currentUserId,
            country,
            university,
            author_name,
            major,
            rating,
            summary,
            good,
            bad,
            fun,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          closeModal();
          alert("投稿しました！承認後に公開されます。");
          renderExperiences();
        } else {
          alert(data.error || "投稿に失敗しました");
        }
      } catch (err) {
        console.error("投稿エラー:", err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "投稿する";
      }
    });
  }

  async function init() {
    await initUser();
    renderCountryFilter();
    initSearch();
    initModal();
    renderExperiences();
  }

  // 文字カウント
  const fields = [
    { id: "exp-summary", countId: "summary-count" },
    { id: "exp-good", countId: "good-count" },
    { id: "exp-bad", countId: "bad-count" },
    { id: "exp-fun", countId: "fun-count" },
  ];
  fields.forEach(({ id, countId }) => {
    const textarea = document.getElementById(id);
    const counter = document.getElementById(countId);
    if (!textarea || !counter) return;
    textarea.addEventListener("input", () => {
      counter.textContent = `${textarea.value.length} / 800`;
    });
  });

  init();
}
