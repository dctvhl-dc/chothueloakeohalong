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
    const trustedOrigin = event.origin === "https://script.google.com"
      || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
    if (!trustedOrigin || !event.data || typeof event.data.id !== "string" || typeof event.data.ok !== "boolean") return;
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
    if (settings.hero_title) document.querySelector(".hero-copy h1").textContent = settings.hero_title;
    if (settings.hero_subtitle || settings.mission) document.querySelector(".hero-copy>p").textContent = settings.hero_subtitle || settings.mission;
    if (settings.about_heading) document.querySelector(".about-copy h2").textContent = settings.about_heading;
    if (settings.booking_title) document.querySelector(".booking-banner h2").textContent = settings.booking_title;
    if (settings.booking_description) document.querySelector(".booking-banner p").textContent = settings.booking_description;
    if (settings.gallery_heading) document.querySelector(".gallery-section h2").textContent = settings.gallery_heading;
    if (settings.news_heading) document.querySelector(".news-section h2").textContent = settings.news_heading;
    if (settings.contact_heading) document.querySelector(".contact-section h2").textContent = settings.contact_heading;
    if (settings.contact_description) document.querySelector(".contact-section>div>p").textContent = settings.contact_description;
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
    if (settings.business_hours) {
      let hours = document.getElementById("contact-hours");
      if (!hours) {
        hours = document.createElement("div");
        hours.id = "contact-hours";
        hours.innerHTML = "<small>GIỜ PHỤC VỤ</small><strong></strong>";
        document.querySelector(".contact-details").append(hours);
      }
      hours.querySelector("strong").textContent = settings.business_hours;
    }
    if (settings.email) {
      let email = document.getElementById("contact-email");
      if (!email) {
        email = document.createElement("a");
        email.id = "contact-email";
        email.innerHTML = "<small>EMAIL LIÊN HỆ</small><strong></strong>";
        document.querySelector(".contact-details").append(email);
      }
      email.href = `mailto:${settings.email}`;
      email.querySelector("strong").textContent = settings.email;
    }
    if (settings.about) document.querySelector(".about-copy>p").textContent = settings.about;
    if (settings.direction) document.querySelector(".about-copy>p:nth-of-type(2)").textContent = settings.direction;
    if (Array.isArray(data.services)) {
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
      document.getElementById("service-note").textContent = data.services.length
        ? "Danh sách dịch vụ được đồng bộ từ Google Sheets."
        : "Hiện chưa có dịch vụ được đăng. Vui lòng liên hệ để được tư vấn.";
    }
    if (Array.isArray(data.posts)) {
      const news = document.getElementById("news-list");
      news.replaceChildren(...data.posts.slice(0, 6).map((post, index) => {
        const article = document.createElement("article");
        article.className = "news-card";
        const art = document.createElement("div");
        art.className = `news-art news-art-${["one", "two", "three"][index % 3]}`;
        if (/^https:\/\//i.test(post.image_url || "")) {
          const image = document.createElement("img");
          image.src = post.image_url;
          image.alt = post.title || "Ảnh bài viết";
          image.loading = "lazy";
          image.decoding = "async";
          art.append(image);
        }
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
        const summary = document.createElement("p");
        summary.className = "news-summary";
        summary.textContent = post.summary || (post.content || "").slice(0, 180);
        const link = document.createElement("a");
        link.textContent = "Đọc bài viết ↗";
        if (post.url && /^https?:\/\//i.test(post.url)) {
          link.href = post.url;
          link.target = "_blank";
          link.rel = "noopener";
        } else link.href = "#news";
        article.append(art, meta, title, summary);
        if (post.content) {
          const details = document.createElement("details");
          const toggle = document.createElement("summary");
          toggle.textContent = "Xem nội dung";
          const content = document.createElement("p");
          content.className = "news-full-content";
          content.textContent = post.content;
          details.append(toggle, content);
          article.append(details);
        }
        if (post.url) article.append(link);
        return article;
      }));
    }
    if (Array.isArray(data.reviews)) {
      const container = document.querySelector(".review-content");
      const eyebrow = container.querySelector(".eyebrow");
      const stars = container.querySelector(".review-stars");
      const controls = container.querySelector(".review-controls");
      stars.hidden = !data.reviews.length;
      controls.hidden = !data.reviews.length;
      const list = document.createElement("div");
      list.className = "review-list";
      data.reviews.slice(0, 6).forEach((review) => {
        const card = document.createElement("article");
        card.className = "review-item";
        const quote = document.createElement("blockquote");
        quote.textContent = `“${review.content || ""}”`;
        const author = document.createElement("strong");
        author.textContent = review.author || "Khách hàng";
        const service = document.createElement("small");
        service.textContent = review.title || "Khách hàng tại Hạ Long";
        card.append(quote, author, service);
        list.append(card);
      });
      container.replaceChildren(eyebrow, stars, list, controls);
    }
    if (Array.isArray(data.gallery)) {
      const grid = document.querySelector(".gallery-grid");
      grid.replaceChildren(...data.gallery.slice(0, 8).map((item, index) => {
        const tile = document.createElement("a");
        tile.className = `gallery-tile gallery-${["one", "two", "three", "four"][index % 4]}`;
        if (/^https:\/\//i.test(item.image_url || "")) {
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
    if (value) showCmsTab(activeCmsTab);
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
  let activeCmsTab = "posts";
  const cmsRoot = document.getElementById("content-management");
  const settingFields = [
    ["hero_title", "Tiêu đề lớn đầu trang"],
    ["hero_subtitle", "Mô tả đầu trang"],
    ["about_heading", "Tiêu đề phần giới thiệu"],
    ["company_name", "Tên doanh nghiệp"],
    ["hotline", "Số điện thoại chính"],
    ["hotline_2", "Số điện thoại phụ"],
    ["address", "Địa chỉ"],
    ["service_area", "Khu vực phục vụ"],
    ["business_hours", "Giờ phục vụ"],
    ["email", "Email liên hệ"],
    ["about", "Giới thiệu doanh nghiệp"],
    ["direction", "Định hướng phát triển"],
    ["booking_title", "Tiêu đề phần đặt thuê"],
    ["booking_description", "Mô tả phần đặt thuê"],
    ["gallery_heading", "Tiêu đề thư viện ảnh"],
    ["news_heading", "Tiêu đề tin tức"],
    ["contact_heading", "Tiêu đề liên hệ"],
    ["contact_description", "Mô tả liên hệ"]
  ];
  const cmsFields = {
    posts: [
      ["title", "Tiêu đề bài viết", "text", true],
      ["summary", "Mô tả ngắn", "textarea", false],
      ["content", "Nội dung bài viết", "textarea", true],
      ["url", "Link bài viết (nếu có)", "url", false],
      ["image_url", "URL ảnh bìa (nếu có)", "url", false]
    ],
    reviews: [
      ["author", "Tên khách hàng", "text", true],
      ["title", "Dịch vụ / tiêu đề (không bắt buộc)", "text", false],
      ["content", "Nội dung đánh giá", "textarea", true]
    ],
    gallery: [
      ["title", "Tên / chú thích ảnh", "text", true],
      ["image_url", "URL ảnh công khai (HTTPS)", "url", true]
    ],
    services: [
      ["name", "Tên dịch vụ", "text", true],
      ["price", "Giá thuê", "text", false],
      ["description", "Mô tả dịch vụ", "textarea", false]
    ]
  };
  const recordCollections = { posts: "posts", reviews: "reviews", gallery: "gallery", services: "services" };
  const contentApiTypes = { posts: "post", reviews: "review", gallery: "gallery", services: "service" };
  const tabTitles = { posts: "Bài viết", reviews: "Đánh giá", gallery: "Thư viện ảnh", services: "Dịch vụ" };

  function makeField(name, labelText, kind, required) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    if (kind !== "textarea") input.type = kind;
    input.required = required;
    if (kind === "textarea") input.rows = name === "content" ? 7 : 3;
    if (name === "image_url" || name === "url") input.maxLength = 1000;
    label.append(input);
    return label;
  }

  function clearRecordForm(form) {
    form.reset();
    form.elements.namedItem("id").value = "";
    form.querySelector("[type=submit]").textContent = "Thêm mới";
    form.querySelector(".cancel-edit").hidden = true;
  }

  function startEditing(form, record) {
    form.elements.namedItem("id").value = record.id || "";
    cmsFields[activeCmsTab].forEach(([name]) => { form.elements.namedItem(name).value = record[name] || ""; });
    form.querySelector("[type=submit]").textContent = "Lưu chỉnh sửa";
    form.querySelector(".cancel-edit").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadContentRecords(type, list) {
    list.textContent = "Đang tải nội dung…";
    try {
      const result = await postApi("listContent", {}, token());
      const records = result[recordCollections[type]] || [];
      if (!records.length) {
        list.textContent = type === "services" ? "Chưa có dịch vụ nào." : "Chưa có nội dung nào. Hãy thêm nội dung mới.";
        return;
      }
      list.replaceChildren(...records.map((record) => {
        const row = document.createElement("article");
        row.className = "cms-record";
        const detail = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = record.title || record.name || record.author || "Nội dung";
        const summary = document.createElement("small");
        summary.textContent = type === "services"
          ? [record.price, record.description].filter(Boolean).join(" · ")
          : [record.author, record.summary || record.content || record.image_url || record.url].filter(Boolean).join(" · ");
        detail.append(title, summary);
        if (type === "gallery" && record.image_url) {
          const image = document.createElement("img");
          image.src = record.image_url;
          image.alt = record.title || "";
          image.loading = "lazy";
          image.className = "cms-thumbnail";
          detail.prepend(image);
        }
        const actions = document.createElement("div");
        actions.className = "cms-record-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Chỉnh sửa";
        edit.addEventListener("click", () => startEditing(form, record));
        const remove = document.createElement("button");
        remove.type = "button";
        const serviceActive = !/^(ngừng|ngưng|inactive|false|0)$/i.test(String(record.status || "").trim());
        remove.textContent = type === "services" ? (serviceActive ? "Ngừng dịch vụ" : "Đã ngừng") : "Xóa";
        remove.disabled = type === "services" && !serviceActive;
        remove.addEventListener("click", async () => {
          const prompt = type === "services"
            ? "Ngừng dịch vụ này? Dịch vụ vẫn được giữ trong lịch sử đơn hàng."
            : "Xóa nội dung này? Thao tác không thể hoàn tác.";
          if (!window.confirm(prompt)) return;
          remove.disabled = true;
          try {
            await postApi("deleteContent", { type: contentApiTypes[type], id: record.id }, token());
            statusText(adminStatus, type === "services" ? "Đã ngừng dịch vụ." : "Đã xóa nội dung.");
            await loadContentRecords(type, list);
            getPublicData().then(paintPublicData).catch(() => {});
          } catch (error) {
            statusText(adminStatus, error.message, true);
            remove.disabled = false;
          }
        });
        actions.append(edit, remove);
        row.append(detail, actions);
        return row;
      }));
    } catch (error) {
      list.textContent = error.message;
      statusText(adminStatus, error.message, true);
    }
  }

  function showCmsTab(type) {
    activeCmsTab = type;
    document.querySelectorAll(".admin-tabs button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tab === type));
    });
    document.getElementById("import-news").hidden = type !== "posts";
    const userManagement = document.getElementById("user-management");
    userManagement.hidden = type !== "users";
    cmsRoot.hidden = type === "users";
    if (type === "users") {
      loadUsers();
      return;
    }
    if (type === "settings") {
      cmsRoot.replaceChildren();
      const form = document.createElement("form");
      form.className = "cms-settings";
      const heading = document.createElement("h3");
      heading.textContent = "Nội dung các phần trên trang";
      const note = document.createElement("p");
      note.textContent = "Các trường này cập nhật trực tiếp phần giới thiệu và liên hệ trên website. Để trống mục không dùng.";
      form.append(heading, note);
      settingFields.forEach(([key, label]) => {
        const field = makeField(key, label, ["about", "direction", "hero_subtitle", "booking_description", "contact_description"].includes(key) ? "textarea" : "text", false);
        form.append(field);
      });
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "button button-lime";
      save.textContent = "Lưu thông tin trang";
      form.append(save);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        save.disabled = true;
        try {
          const settings = Object.fromEntries(settingFields.map(([key]) => [key, form.elements.namedItem(key).value]));
          await postApi("saveSettings", { settings }, token());
          statusText(adminStatus, "Đã lưu thông tin trang.");
          getPublicData().then(paintPublicData).catch(() => {});
        } catch (error) {
          statusText(adminStatus, error.message, true);
        } finally {
          save.disabled = false;
        }
      });
      cmsRoot.append(form);
      postApi("listContent", {}, token()).then((result) => {
        settingFields.forEach(([key]) => { form.elements.namedItem(key).value = result.settings[key] || ""; });
      }).catch((error) => statusText(adminStatus, error.message, true));
      return;
    }
    const fields = cmsFields[type];
    if (!fields) return;
    cmsRoot.replaceChildren();
    const form = document.createElement("form");
    form.className = "cms-form";
    const id = document.createElement("input");
    id.type = "hidden";
    id.name = "id";
    form.append(id);
    const heading = document.createElement("h3");
    heading.textContent = `${tabTitles[type]} · thêm mới hoặc chỉnh sửa`;
    form.append(heading);
    fields.forEach(([name, label, kind, required]) => form.append(makeField(name, label, kind, required)));
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "button button-lime";
    save.textContent = "Thêm mới";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "text-link cancel-edit";
    cancel.textContent = "Hủy chỉnh sửa";
    cancel.hidden = true;
    cancel.addEventListener("click", () => clearRecordForm(form));
    form.append(save, cancel);
    const listHeading = document.createElement("h3");
    listHeading.textContent = `Nội dung đã tạo · ${tabTitles[type]}`;
    const list = document.createElement("div");
    list.className = "cms-record-list";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      save.disabled = true;
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        await postApi("saveContent", { ...data, type: contentApiTypes[type] }, token());
        statusText(adminStatus, data.id ? "Đã cập nhật nội dung." : "Đã thêm nội dung.");
        clearRecordForm(form);
        await loadContentRecords(type, list);
        getPublicData().then(paintPublicData).catch(() => {});
      } catch (error) {
        statusText(adminStatus, error.message, true);
      } finally {
        save.disabled = false;
      }
    });
    cmsRoot.append(form, listHeading, list);
    loadContentRecords(type, list);
  }

  document.querySelectorAll(".admin-tabs button").forEach((button) => button.addEventListener("click", () => showCmsTab(button.dataset.tab)));
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
  const importButton = document.getElementById("import-news");
  importButton.addEventListener("click", async () => {
    try {
      const result = await postApi("importNews", { url: "https://sites.google.com/view/chothueloakeohalong" }, token());
      statusText(adminStatus, `Đã nhập ${result.imported || 0} tiêu đề bài viết.`);
      showCmsTab("posts");
      getPublicData().then(paintPublicData).catch(() => {});
    } catch (error) { statusText(adminStatus, error.message, true); }
  });
})();
