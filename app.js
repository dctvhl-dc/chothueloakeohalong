(() => {
  const config = window.SITE_CONFIG || { apiUrl: "" };
  const apiUrl = () => (document.getElementById("admin-endpoint")?.value.trim() || config.apiUrl || "").replace(/\/+$/, "");
  const bookingDialog = document.getElementById("booking-dialog");
  const adminDialog = document.getElementById("admin-dialog");
  const statusText = (node, text, error = false) => {
    node.textContent = text;
    node.classList.toggle("error", error);
  };
  document.getElementById("year").textContent = new Date().getFullYear();
  const dateInput = document.querySelector('#booking-form input[name="date"]');
  dateInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const menuToggle = document.querySelector(".menu-toggle");
  menuToggle.addEventListener("click", () => {
    const nav = document.querySelector(".main-nav");
    const open = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
  });
  document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => {
    document.querySelector(".main-nav").classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));
  document.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.getElementById("open-booking").addEventListener("click", () => bookingDialog.showModal());
  document.addEventListener("click", (event) => {
    if (!event.target.closest('a[href="#booking"]')) return;
    if (!bookingDialog.open) bookingDialog.showModal();
  });
  document.querySelector(".admin-link").addEventListener("click", (event) => {
    event.preventDefault();
    adminDialog.showModal();
  });

  let requestSequence = 0;
  const pendingRequests = new Map();
  const responseFrame = document.createElement("iframe");
  responseFrame.name = "sheets-api-response";
  responseFrame.title = "Phản hồi gửi yêu cầu";
  responseFrame.hidden = true;
  document.body.append(responseFrame);
  window.addEventListener("message", (event) => {
    if (event.source !== responseFrame.contentWindow || !event.data || typeof event.data.id !== "string") return;
    const resolve = pendingRequests.get(event.data.id);
    if (!resolve) return;
    pendingRequests.delete(event.data.id);
    resolve(event.data);
  });

  function postApi(action, data = {}, token = "") {
    const endpoint = apiUrl();
    if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) {
      return Promise.reject(new Error("Vui lòng cấu hình URL Apps Script Web App hợp lệ trước."));
    }
    return new Promise((resolve, reject) => {
      const id = `r${Date.now()}_${++requestSequence}`;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = endpoint;
      form.target = responseFrame.name;
      form.hidden = true;
      const payload = { action, data, token };
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = JSON.stringify({ ...payload, requestId: id });
      form.append(input);
      document.body.append(form);
      const timeout = window.setTimeout(() => {
        pendingRequests.delete(id);
        form.remove();
        reject(new Error("Máy chủ chưa phản hồi. Hãy thử lại hoặc liên hệ hotline."));
      }, 20000);
      pendingRequests.set(id, (message) => {
        window.clearTimeout(timeout);
        form.remove();
        if (message.ok && message.data?.ok) resolve(message.data);
        else reject(new Error(message.data?.error || "Không thể hoàn tất yêu cầu."));
      });
      form.submit();
    });
  }

  let services = [];
  function populateServices(items) {
    services = items.filter((item) => item && item.status !== "Ngừng" && item.status !== "inactive");
    const select = document.getElementById("booking-service");
    select.replaceChildren(new Option("Chọn dịch vụ quan tâm", ""));
    if (!services.length) {
      select.add(new Option("Chưa tải được danh sách dịch vụ — ghi chú nhu cầu bên dưới", "other"));
      return;
    }
    services.forEach((service) => {
      const option = new Option(`${service.name}${service.price ? ` — ${service.price}` : ""}`, service.id || service.name);
      option.dataset.name = service.name || "";
      option.dataset.price = service.price || "";
      select.add(option);
    });
    select.add(new Option("Dịch vụ khác / cần tư vấn", "other"));
  }

  const callbackPrefix = `loaCallback_${Date.now()}_`;
  let jsonpSequence = 0;
  function getPublicData() {
    const endpoint = apiUrl();
    if (!endpoint) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const callbackName = `${callbackPrefix}${++jsonpSequence}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => finish(new Error("Hết thời gian chờ dữ liệu.")), 12000);
      function finish(error, result) {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
        if (error) reject(error);
        else resolve(result);
      }
      window[callbackName] = (result) => finish(null, result);
      script.onerror = () => finish(new Error("Không tải được dữ liệu Google Sheets."));
      script.src = `${endpoint}?action=public&callback=${callbackName}`;
      document.head.append(script);
    });
  }

  function paintPublicData(data) {
    if (!data || !data.ok) return;
    const settings = data.settings || {};
    if (settings.company_name) {
      document.querySelectorAll(".brand-name").forEach((node) => {
        node.firstChild.nodeValue = settings.company_name;
        const suffix = node.querySelector("span");
        if (suffix) suffix.hidden = true;
      });
      document.title = `${settings.company_name} — Âm thanh cho ngày vui`;
    }
    if (settings.hotline) {
      const number = settings.hotline.replace(/\D/g, "");
      document.querySelectorAll('.contact-details a[href^="tel:"]').forEach((link, index) => {
        if (index !== 0) return;
        link.href = `tel:${number}`;
        link.querySelector("strong").firstChild.textContent = settings.hotline;
      });
      document.querySelector(".phone-link").href = `tel:${number}`;
      document.querySelector(".phone-link strong").textContent = settings.hotline;
      document.querySelector(".announcement a").href = `tel:${number}`;
      document.querySelector(".floating-call").href = `tel:${number}`;
    }
    if (settings.hotline_2) {
      const link = document.querySelectorAll('.contact-details a[href^="tel:"]')[1];
      if (link) {
        link.href = `tel:${settings.hotline_2.replace(/\D/g, "")}`;
        link.querySelector("strong").firstChild.textContent = settings.hotline_2;
      }
    }
    if (settings.address || settings.service_area) {
      const address = document.querySelector(".contact-details>div strong");
      address.textContent = settings.address || settings.service_area;
    }
    if (settings.about) document.querySelector(".about-copy>p").textContent = settings.about;
    if (Array.isArray(data.services) && data.services.length) {
      populateServices(data.services);
      const host = document.getElementById("service-list");
      host.replaceChildren(...data.services.slice(0, 9).map((service, index) => {
        const card = document.createElement("article");
        card.className = "service-card";
        const art = document.createElement("div");
        art.className = `service-art ${["art-portable", "art-stack", "art-event"][index % 3]}`;
        const number = document.createElement("span");
        number.textContent = String(index + 1).padStart(2, "0");
        const speaker = document.createElement("div");
        speaker.className = "mini-speaker";
        const cone = document.createElement("i");
        speaker.append(cone.cloneNode(), cone.cloneNode());
        art.append(number, speaker);
        const info = document.createElement("div");
        info.className = "service-info";
        const tag = document.createElement("div");
        tag.className = "service-tag";
        tag.textContent = "DỊCH VỤ CHO THUÊ";
        const title = document.createElement("h3");
        title.textContent = service.name || "Dịch vụ âm thanh";
        const description = document.createElement("p");
        description.textContent = service.description || "Liên hệ để được tư vấn thiết bị phù hợp.";
        const bottom = document.createElement("div");
        bottom.className = "service-bottom";
        const price = document.createElement("strong");
        const numericPrice = Number(String(service.price || "").replace(/[^\d]/g, ""));
        price.textContent = numericPrice ? `${new Intl.NumberFormat("vi-VN").format(numericPrice)}đ / buổi` : "Liên hệ báo giá";
        const action = document.createElement("a");
        action.href = "#booking";
        action.setAttribute("aria-label", `Yêu cầu ${service.name || "dịch vụ"}`);
        action.textContent = "↗";
        bottom.append(price, action);
        info.append(tag, title, description, bottom);
        card.append(art, info);
        return card;
      }));
      document.getElementById("service-note").textContent = "Danh sách dịch vụ được đồng bộ từ Google Sheets.";
    }
    if (Array.isArray(data.posts) && data.posts.length) {
      const news = document.getElementById("news-list");
      news.replaceChildren(...data.posts.slice(0, 6).map((post, index) => {
        const article = document.createElement("article");
        article.className = "news-card";
        const art = document.createElement("div");
        art.className = `news-art news-art-${["one", "two", "three"][index % 3]}`;
        const label = document.createElement("span");
        label.textContent = "CHUYỆN LOA, CHUYỆN HẠ LONG";
        const icon = document.createElement("b");
        icon.textContent = "♫";
        art.append(label, icon);
        const meta = document.createElement("div");
        meta.className = "news-meta";
        meta.textContent = post.created_at || "TIN TỨC";
        const title = document.createElement("h3");
        title.textContent = post.title || "Bài viết";
        const link = document.createElement("a");
        link.textContent = "Đọc bài viết ↗";
        if (post.url && /^https?:\/\//i.test(post.url)) {
          link.href = post.url;
          link.target = "_blank";
          link.rel = "noopener";
        } else link.href = "#news";
        article.append(art, meta, title, link);
        return article;
      }));
    }
    if (Array.isArray(data.reviews) && data.reviews.length) {
      const review = data.reviews[0];
      document.querySelector(".review-content blockquote").textContent = `“${review.content || review.title || ""}”`;
      const reviewer = document.querySelector(".review-byline b");
      reviewer.textContent = review.author || "Khách hàng tại Hạ Long";
    }
    if (Array.isArray(data.gallery) && data.gallery.length) {
      const grid = document.querySelector(".gallery-grid");
      grid.replaceChildren(...data.gallery.slice(0, 8).map((item, index) => {
        const tile = document.createElement("a");
        tile.className = `gallery-tile gallery-${["one", "two", "three", "four"][index % 4]}`;
        if (/^https?:\/\//i.test(item.image_url || "")) {
          tile.classList.add("has-image");
          tile.href = item.image_url;
          tile.target = "_blank";
          tile.rel = "noopener";
          const image = document.createElement("img");
          image.src = item.image_url;
          image.alt = item.title || "Khoảnh khắc cho thuê loa tại Hạ Long";
          image.loading = "lazy";
          image.decoding = "async";
          tile.append(image);
        } else tile.href = "#gallery";
        const icon = document.createElement("span");
        icon.className = "gallery-emoji";
        icon.textContent = "♫";
        const caption = document.createElement("span");
        caption.textContent = item.title || `KHOẢNH KHẮC ${String(index + 1).padStart(2, "0")}`;
        tile.append(icon, caption);
        return tile;
      }));
    }
  }

  populateServices([]);
  getPublicData().then(paintPublicData).catch(() => {
    document.getElementById("service-note").textContent = "Chưa kết nối dữ liệu. Vui lòng liên hệ hotline để được báo giá.";
  });

  document.getElementById("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const status = document.getElementById("booking-status");
    const values = new FormData(form);
    const selected = document.getElementById("booking-service").selectedOptions[0];
    const serviceId = String(values.get("service") || "");
    const chosen = services.find((service) => service.id === serviceId || service.name === serviceId);
    button.disabled = true;
    button.textContent = "Đang gửi yêu cầu…";
    statusText(status, "");
    try {
      await postApi("booking", {
        website: String(values.get("website") || ""),
        customer_name: String(values.get("name")).trim(),
        customer_phone: String(values.get("phone")).trim(),
        service_id: chosen?.id || "",
        service_name: chosen?.name || (serviceId === "other" ? "Cần tư vấn" : selected?.textContent || ""),
        service_price: chosen?.price || "",
        service_time: String(values.get("date")),
        location_text: String(values.get("location")).trim(),
        note: String(values.get("note")).trim()
      });
      statusText(status, "Đã nhận yêu cầu! Chúng tôi sẽ sớm liên hệ xác nhận lịch và giá thuê.");
      form.reset();
    } catch (error) {
      statusText(status, error.message, true);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Gửi yêu cầu <span>↗</span>';
    }
  });

  const adminStatus = document.getElementById("admin-status");
  const endpointInput = document.getElementById("admin-endpoint");
  if (config.apiUrl) endpointInput.value = config.apiUrl;
  else {
    try { endpointInput.value = localStorage.getItem("loa-api-url") || ""; } catch (_) { /* Storage may be disabled. */ }
  }
  endpointInput.addEventListener("change", () => {
    try { localStorage.setItem("loa-api-url", endpointInput.value.trim()); } catch (_) { /* Storage may be disabled. */ }
  });
  function token() {
    try { return sessionStorage.getItem("loa-admin-token") || ""; } catch (_) { return ""; }
  }
  function setAdminLoggedIn(value, admin) {
    const panel = document.getElementById("admin-panel");
    panel.hidden = !value;
    document.getElementById("admin-login").hidden = value;
    ["admin-user", "admin-password", "admin-endpoint"].forEach((id) => {
      document.getElementById(id).disabled = value;
    });
    if (admin) statusText(adminStatus, `Đã đăng nhập: ${admin.full_name || admin.username}`);
    else statusText(adminStatus, "");
  }
  document.getElementById("admin-login").addEventListener("click", async () => {
    const username = document.getElementById("admin-user").value.trim();
    const password = document.getElementById("admin-password").value;
    try {
      const result = await postApi("login", { username, password });
      if (!result.token || !result.user) throw new Error("Máy chủ trả về phiên đăng nhập không hợp lệ.");
      try { sessionStorage.setItem("loa-admin-token", result.token); } catch (_) { /* Session storage may be disabled. */ }
      setAdminLoggedIn(true, result.user);
    } catch (error) { statusText(adminStatus, error.message, true); }
  });
  document.getElementById("admin-logout").addEventListener("click", async () => {
    try { await postApi("logout", {}, token()); } catch (_) { /* Clear the local session even if offline. */ }
    try { sessionStorage.removeItem("loa-admin-token"); } catch (_) { /* Session storage may be disabled. */ }
    setAdminLoggedIn(false);
  });
  document.querySelectorAll(".admin-tabs button").forEach((button) => button.addEventListener("click", () => {
    document.getElementById("content-form").style.display = button.dataset.tab === "content" ? "block" : "none";
    document.getElementById("user-management").hidden = button.dataset.tab !== "users";
    const importButton = document.getElementById("import-news");
    importButton.hidden = button.dataset.tab !== "news";
    if (button.dataset.tab === "users") loadUsers();
  }));
  async function loadUsers() {
    const list = document.getElementById("user-list");
    try {
      const result = await postApi("listUsers", {}, token());
      list.replaceChildren(...result.users.map((user) => {
        const row = document.createElement("div");
        row.className = "user-row";
        const detail = document.createElement("span");
        const name = document.createElement("b");
        name.textContent = user.full_name || user.username;
        const meta = document.createElement("small");
        meta.textContent = `${user.username} · ${user.role} · ${user.is_active ? "Hoạt động" : "Đã khóa"}`;
        detail.append(name, meta);
        const action = document.createElement("button");
        action.type = "button";
        action.textContent = user.is_active ? "Khóa" : "Mở khóa";
        action.disabled = user.id === "";
        action.addEventListener("click", async () => {
          action.disabled = true;
          try {
            await postApi("setUserState", { id: user.id, active: !user.is_active }, token());
            await loadUsers();
          } catch (error) {
            statusText(adminStatus, error.message, true);
            action.disabled = false;
          }
        });
        row.append(detail, action);
        return row;
      }));
      if (!result.users.length) list.textContent = "Chưa có tài khoản.";
    } catch (error) {
      list.textContent = error.message;
    }
  }
  document.getElementById("content-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await postApi("saveContent", { type: form.get("type"), title: form.get("title"), body: form.get("body") }, token());
      statusText(adminStatus, "Đã lưu nội dung.");
      event.currentTarget.reset();
      getPublicData().then(paintPublicData).catch(() => {});
    } catch (error) { statusText(adminStatus, error.message, true); }
  });
  document.getElementById("user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await postApi("createUser", {
        username: form.get("username"), password: form.get("password"),
        full_name: form.get("fullName"), phone: form.get("phone"), role: form.get("role")
      }, token());
      statusText(adminStatus, "Đã tạo người dùng.");
      event.currentTarget.reset();
      loadUsers();
    } catch (error) { statusText(adminStatus, error.message, true); }
  });
  const importButton = document.createElement("button");
  importButton.id = "import-news";
  importButton.className = "button button-lime";
  importButton.type = "button";
  importButton.textContent = "Lấy bài viết từ Google Sites";
  importButton.hidden = true;
  document.getElementById("admin-panel").append(importButton);
  importButton.addEventListener("click", async () => {
    try {
      const result = await postApi("importNews", { url: "https://sites.google.com/view/chothueloakeohalong" }, token());
      statusText(adminStatus, `Đã nhập ${result.imported || 0} tiêu đề bài viết.`);
      getPublicData().then(paintPublicData).catch(() => {});
    } catch (error) { statusText(adminStatus, error.message, true); }
  });
})();
