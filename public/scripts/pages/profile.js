// =====================
// profile.js
// パス: /public/scripts/pages/profile.js
// 使用: /public/student-japan/profile.html
// 用途: プロフィール・お気に入り大学
// =====================

const path = window.location.pathname;

if (path === "/student-japan/profile.html") {
  const currentUserId = parseInt(localStorage.getItem("user_id") || "0");
  let favorites = JSON.parse(localStorage.getItem("fav_universities") || "[]");
  let memos = JSON.parse(localStorage.getItem("fav_memos") || "{}");
  let undoBuffer = null;
  let undoTimer = null;

  // =====================
  // 初期化
  // =====================
  async function init() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        document.getElementById("not-logged-in").style.display = "block";
        return;
      }
      const user = await res.json();
      document.getElementById("logged-in").style.display = "block";
      document.getElementById("profileName").textContent =
        user.username || "ユーザー";
      document.getElementById("profileEmail").textContent = user.email || "";
      const avatarEl = document.getElementById('profileAvatar')
      if (user.avatar && user.avatar.startsWith('http')) {
        avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${user.username}">`
      } else {
        avatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase()
      }
      document.getElementById("editUsername").value = user.username || "";

      // お気に入りはlocalStorageから（ログイン実装後にDB連携）
      favorites = JSON.parse(localStorage.getItem("fav_universities") || "[]");
      renderFavTable();
      initEditForm(user.id);
      initLogout();
    } catch (err) {
      document.getElementById("not-logged-in").style.display = "block";
    }
  }

  // =====================
  // 編集フォーム
  // =====================
  function initEditForm(user) {
    const editBtn   = document.getElementById('editBtn')
    const editForm  = document.getElementById('editForm')
    const saveBtn   = document.getElementById('saveBtn')
    const cancelBtn = document.getElementById('cancelBtn')

    editBtn.addEventListener('click', () => {
      editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none'
    })

    cancelBtn.addEventListener('click', () => {
      editForm.style.display = 'none'
      document.getElementById('editUsername').value = user.username || ''
    })

    saveBtn.addEventListener('click', async () => {
      const newUsername = document.getElementById('editUsername').value.trim()
      if (!newUsername) { alert('ユーザーネームを入力してください'); return }

      try {
        const res = await fetch('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newUsername })
        })
        const data = await res.json()
        if (!data.ok) { alert('保存に失敗しました'); return }

        user.username = newUsername
        document.getElementById('profileName').textContent = newUsername
        const avatarEl = document.getElementById('profileAvatar')
        if (user.avatar && user.avatar.startsWith('http')) {
          avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="${newUsername}">`
        } else {
          avatarEl.textContent = newUsername.charAt(0).toUpperCase()
        }
        editForm.style.display = 'none'
      } catch (err) {
        alert('保存に失敗しました')
      }
    })
  }

  // =====================
  // ログアウト
  // =====================
  function initLogout() {
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      if (!confirm("ログアウトしますか？")) return;
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/student-japan/login.html";
    });
  }

  // =====================
  // テーブル描画
  // =====================
  window.renderFavTable = function () {
    const q = (document.getElementById("favSearch")?.value || "").toLowerCase();
    const container = document.getElementById("favContainer");
    const filtered = favorites.filter(
      (u) => !q || u.name.toLowerCase().includes(q),
    );
    const countEl = document.getElementById("favCount");
    if (countEl) countEl.textContent = `${favorites.length}校 / 30校`;

    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="profile__fav-empty">
          <div style="font-size:48px;margin-bottom:12px;">⭐</div>
          <p>お気に入りに登録された大学はありません。</p>
          <a href="/student-japan/scholarship.html" class="thread__back" style="margin-top:16px;display:inline-block;">大学奨学金マップへ →</a>
        </div>`;
      return;
    }

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="profile__fav-empty"><p>該当する大学が見つかりません。</p></div>';
      return;
    }

    // 行定義
    const rows = [
      { section: "基本情報" },
      { label: "種類", key: "type" },
      { label: "国", key: "country" },
      { label: "都市", key: "city" },
      { label: "気候", key: "climate" },
      {
        label: "学生数",
        key: null,
        custom: (u) =>
          u.students != null
            ? Number(u.students).toLocaleString() + " 人"
            : null,
      },
      {
        label: "留学生割合",
        key: null,
        custom: (u) => (u.intl_ratio != null ? u.intl_ratio + "%" : null),
      },
      { label: "大学群", key: "elite_group" },
      { section: "合格率" },
      {
        label: "全体合格率",
        key: null,
        custom: (u) =>
          u.acceptance_total != null ? u.acceptance_total + "%" : null,
      },
      {
        label: "男性合格率",
        key: null,
        custom: (u) =>
          u.acceptance_man != null ? u.acceptance_man + "%" : null,
      },
      {
        label: "女性合格率",
        key: null,
        custom: (u) =>
          u.acceptance_woman != null ? u.acceptance_woman + "%" : null,
      },
      {
        label: "留学生合格率",
        key: null,
        custom: (u) =>
          u.acceptance_intl != null ? u.acceptance_intl + "%" : null,
      },
      {
        label: "ED合格率",
        key: null,
        custom: (u) => (u.acceptance_ed != null ? u.acceptance_ed + "%" : null),
      },
      {
        label: "EA合格率",
        key: null,
        custom: (u) => (u.acceptance_ea != null ? u.acceptance_ea + "%" : null),
      },
      {
        label: "RD合格率",
        key: null,
        custom: (u) => (u.acceptance_rd != null ? u.acceptance_rd + "%" : null),
      },
      { section: "目安スコア" },
      { label: "GPA", key: "gpa" },
      { label: "SAT総合", key: "application_sat_total" },
      { label: "SAT R&W", key: "application_sat_rw" },
      { label: "SAT Math", key: "application_sat_math" },
      { label: "ACT総合", key: "application_act_total" },
      { label: "ACT English", key: "application_act_english" },
      { label: "ACT Math", key: "application_act_math" },
      { label: "ACT Science", key: "application_act_science" },
      { section: "語学条件" },
      { label: "TOEFL", key: "toefl_total" },
      {
        label: "TOEFL R/L/S/W",
        key: null,
        custom: (u) => {
          const v = [
            u.toefl_reading,
            u.toefl_listening,
            u.toefl_speaking,
            u.toefl_writing,
          ];
          return v.some((x) => x != null)
            ? v.map((x) => x ?? "-").join(" / ")
            : null;
        },
      },
      { label: "IELTS", key: "ielts_total" },
      {
        label: "IELTS R/L/S/W",
        key: null,
        custom: (u) => {
          const v = [
            u.ielts_reading,
            u.ielts_listening,
            u.ielts_speaking,
            u.ielts_writing,
          ];
          return v.some((x) => x != null)
            ? v.map((x) => x ?? "-").join(" / ")
            : null;
        },
      },
      { label: "Duolingo", key: "duolingo_total" },
      { section: "学費・生活費" },
      {
        label: "授業料",
        key: null,
        custom: (u) =>
          u.tuition != null
            ? `${u.tuition_currency || "USD"} ${Number(u.tuition).toLocaleString()}`
            : null,
      },
      {
        label: "生活費",
        key: null,
        custom: (u) =>
          u.living != null
            ? `${u.living_currency || "USD"} ${Number(u.living).toLocaleString()}`
            : null,
      },
      {
        label: "合計",
        key: null,
        custom: (u) =>
          u.tuition && u.living
            ? `${u.tuition_currency || "USD"} ${(Number(u.tuition) + Number(u.living)).toLocaleString()}`
            : null,
      },
      {
        label: "Need-based",
        key: null,
        custom: (u) => (u.need_based ? "対応" : null),
      },
      {
        label: "Need Met",
        key: null,
        custom: (u) => (u.need_met != null ? u.need_met + "%" : null),
      },
      {
        label: "平均奨学金",
        key: null,
        custom: (u) =>
          u.average_amount_scholarship != null
            ? `${u.tuition_currency || "USD"} ${Number(u.average_amount_scholarship).toLocaleString()}`
            : null,
      },
      { section: "財団" },
      { label: "対象財団", key: "foundation" },
      { section: "メモ" },
      { label: "📝 メモ", key: null, custom: null, isMemo: true },
    ];

    const table = document.createElement("table");
    table.className = "fav-table";

    // ヘッダー行
    const thead = document.createElement("thead");
    const univRow = document.createElement("tr");
    univRow.className = "univ-header";
    const thLabel = document.createElement("th");
    thLabel.textContent = "項目";
    univRow.appendChild(thLabel);
    filtered.forEach((u) => {
      const th = document.createElement("th");
      th.innerHTML = `
        <div class="univ-th-name">${u.url ? `<a href="${u.url}" target="_blank">${esc(u.name)} ↗</a>` : esc(u.name)}</div>
        ${u.city ? `<div class="univ-th-loc">📍 ${esc(u.city)}${u.climate ? " · " + esc(u.climate) : ""}</div>` : ""}
        <button class="star-btn active" onclick="removeFavById(${u.id})">★</button>
      `;
      univRow.appendChild(th);
    });
    thead.appendChild(univRow);
    table.appendChild(thead);

    // ボディ
    const tbody = document.createElement("tbody");

    rows.forEach((row) => {
      if (row.section) {
        const secRow = document.createElement("tr");
        secRow.className = "section-header";
        const secTd = document.createElement("td");
        secTd.setAttribute("colspan", filtered.length + 1);
        secTd.textContent = row.section;
        secRow.appendChild(secTd);
        tbody.appendChild(secRow);
        return;
      }

      if (row.isMemo) {
        const memoRow = document.createElement("tr");
        memoRow.className = "memo-row";
        const memoLabel = document.createElement("td");
        memoLabel.textContent = "📝 メモ";
        memoRow.appendChild(memoLabel);
        filtered.forEach((u) => {
          const td = document.createElement("td");
          const memo = memos[u.id] || "";
          td.innerHTML = `
            <textarea class="memo-area" id="memo_${u.id}" maxlength="400" placeholder="メモ...">${esc(memo)}</textarea>
            <div class="memo-footer">
              <span class="memo-saved" id="ms_${u.id}">保存 ✓</span>
              <span id="mc_${u.id}">${memo.length}/400</span>
            </div>
          `;
          memoRow.appendChild(td);
        });
        tbody.appendChild(memoRow);
        return;
      }

      // データのある行だけ表示
      const hasData = filtered.some((u) => {
        const val = row.custom ? row.custom(u) : u[row.key];
        return val != null && val !== "" && val !== false;
      });
      if (!hasData) return;

      const tr = document.createElement("tr");
      tr.className = "data-row";
      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label;
      tr.appendChild(tdLabel);
      filtered.forEach((u) => {
        const td = document.createElement("td");
        const val = row.custom ? row.custom(u) : u[row.key];
        td.innerHTML =
          val == null || val === "" || val === false
            ? '<span class="val-none">—</span>'
            : esc(String(val));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.appendChild(table);
    container.innerHTML = "";
    container.appendChild(scroll);
  };

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =====================
  // お気に入り解除
  // =====================
  window.removeFavById = function (id) {
    const idx = favorites.findIndex((u) => u.id === id);
    if (idx < 0) return;
    undoBuffer = { univ: favorites[idx], idx };
    favorites.splice(idx, 1);
    localStorage.setItem("fav_universities", JSON.stringify(favorites));
    renderFavTable();
    clearTimeout(undoTimer);
    document.getElementById("undoMsg").textContent =
      `${undoBuffer.univ.name} を削除しました`;
    document.getElementById("undoToast").classList.add("show");
    undoTimer = setTimeout(() => {
      document.getElementById("undoToast").classList.remove("show");
      undoBuffer = null;
    }, 5000);
  };

  window.undoRemove = function () {
    if (!undoBuffer) return;
    favorites.splice(undoBuffer.idx, 0, undoBuffer.univ);
    localStorage.setItem("fav_universities", JSON.stringify(favorites));
    undoBuffer = null;
    clearTimeout(undoTimer);
    document.getElementById("undoToast").classList.remove("show");
    renderFavTable();
  };

  // メモ自動保存
  document.addEventListener("input", (e) => {
    if (!e.target.classList.contains("memo-area")) return;
    const id = parseInt(e.target.id.replace("memo_", ""));
    const val = e.target.value;
    memos[id] = val;
    localStorage.setItem("fav_memos", JSON.stringify(memos));
    const mc = document.getElementById(`mc_${id}`);
    const ms = document.getElementById(`ms_${id}`);
    if (mc) mc.textContent = val.length + "/400";
    if (ms) {
      ms.style.display = "block";
      setTimeout(() => (ms.style.display = "none"), 1500);
    }
  });

  init();
}
