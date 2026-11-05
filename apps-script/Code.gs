const CONFIG = {
  spreadsheetId: "", // Set this in Apps Script project settings as SHEET_ID.
  bookingHeaders: [
    "id", "created_at", "customer_name", "customer_phone", "services_info",
    "service_time", "install_time", "collect_time", "location_text",
    "gps_location", "map_link", "note", "total_cost", "paid_amount",
    "submitted_to_company", "debt_amount", "require_invoice", "invoice_info",
    "status", "assigned_user", "created_by", "updated_by", "updated_at"
  ],
  userHeaders: [
    "id", "username", "password", "role", "full_name", "phone", "created_at",
    "is_active", "must_change_password", "reset_requested"
  ],
  sessionSeconds: 21600,
  sourceSite: "https://sites.google.com/view/chothueloakeohalong"
};
const PUBLIC_SETTING_KEYS = [
  "company_name", "hotline", "hotline_2", "address", "service_area",
  "about", "direction", "mission", "business_hours", "email", "hero_title",
  "hero_subtitle", "about_heading", "booking_title", "booking_description",
  "gallery_heading", "news_heading", "contact_heading", "contact_description"
];

function doGet(e) {
  const callback = (e && e.parameter && e.parameter.callback) || "";
  if (!/^loaCallback_\d+_\d+$/.test(callback)) {
    return ContentService.createTextOutput("Invalid callback").setMimeType(ContentService.MimeType.TEXT);
  }
  try {
    const result = publicData_();
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(result) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    console.error("Public data request failed: " + safeMessage_(error));
    return ContentService.createTextOutput(callback + "(" + JSON.stringify({ ok: false, error: "Không tải được dữ liệu." }) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function canonicalHeader_(sheetName, header) {
  const raw = String(header || "").trim().toLowerCase();
  const aliases = {
    Services: {
      id: ["id", "mã", "mã dịch vụ"], name: ["name", "tên dịch vụ", "tên", "tên thiết bị"],
      price: ["price", "giá", "đơn giá", "đơn giá (vnđ)", "giá thuê"],
      description: ["description", "mô tả"], status: ["status", "trạng thái"],
      quantity: ["quantity", "số lượng", "số lượng có thể nhận", "sl"]
    },
    Bookings: {
      id: ["id", "mã đơn", "mã"], created_at: ["created_at", "ngày tạo"],
      customer_name: ["customer_name", "tên khách hàng", "khách hàng", "họ và tên khách"],
      customer_phone: ["customer_phone", "số điện thoại khách", "sđt khách", "số điện thoại"],
      services_info: ["services_info", "dịch vụ", "thông tin dịch vụ"],
      service_time: ["service_time", "thời gian sử dụng"], install_time: ["install_time", "thời gian giao", "giờ giao"],
      collect_time: ["collect_time", "thời gian thu hồi", "giờ thu hồi"],
      location_text: ["location_text", "địa chỉ", "địa điểm"], gps_location: ["gps_location", "gps", "tọa độ", "toạ độ"],
      map_link: ["map_link", "link google map", "link bản đồ", "link google maps"],
      note: ["note", "ghi chú", "ghi chú đơn hàng"], total_cost: ["total_cost", "tổng chi phí", "tổng tiền"],
      paid_amount: ["paid_amount", "đã thanh toán", "đã thu"], submitted_to_company: ["submitted_to_company", "đã nộp cty", "đã nộp công ty"],
      debt_amount: ["debt_amount", "công nợ", "chưa thanh toán"],
      require_invoice: ["require_invoice", "xuất hóa đơn", "xuất hoá đơn", "yêu cầu hóa đơn"],
      invoice_info: ["invoice_info", "thông tin hóa đơn", "thông tin hoá đơn"],
      status: ["status", "trạng thái"], assigned_user: ["assigned_user", "nhân viên", "người phụ trách", "nhân viên phụ trách"],
      created_by: ["created_by", "người tạo"], updated_by: ["updated_by", "người cập nhật"],
      updated_at: ["updated_at", "cập nhật lúc"]
    },
    Users: {
      id: ["id", "mã", "mã nv", "mã nhân viên"], username: ["username", "tên đăng nhập", "tài khoản"],
      password: ["password", "mật khẩu"], role: ["role", "phân quyền", "quyền", "vai trò"],
      full_name: ["full_name", "họ và tên", "họ tên", "tên nhân viên"],
      phone: ["phone", "số điện thoại", "sđt", "điện thoại"],
      is_active: ["is_active", "trạng thái", "hoạt động"], created_at: ["created_at", "ngày tạo"],
      must_change_password: ["must_change_password", "phải đổi mật khẩu"],
      reset_requested: ["reset_requested", "yêu cầu đặt lại mật khẩu"]
    }
  }[sheetName];
  if (!aliases) return raw;
  for (const canonical in aliases) if (aliases[canonical].indexOf(raw) >= 0) return canonical;
  return raw;
}

function findColumn_(headers, sheetName, canonical) {
  for (let index = 0; index < headers.length; index++) {
    if (canonicalHeader_(sheetName, headers[index]) === canonical) return index;
  }
  return -1;
}

function doPost(e) {
  let requestId = "";
  let result;
  try {
    const body = JSON.parse((e && e.parameter && e.parameter.payload) || "{}");
    requestId = String(body.requestId || "");
    if (!/^r\d+_\d+$/.test(requestId)) throw new Error("Yêu cầu không hợp lệ.");
    const data = body.data && typeof body.data === "object" ? body.data : {};
    result = handleAction_(String(body.action || ""), data, String(body.token || ""));
  } catch (error) {
    result = { ok: false, error: safeMessage_(error) };
  }
  const response = JSON.stringify({ id: requestId, ok: true, data: result })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return HtmlService.createHtmlOutput(
    "<!doctype html><meta charset=\"utf-8\"><script>window.top.parent.postMessage(" +
    response + ",'*');</script>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleAction_(action, data, token) {
  switch (action) {
    case "booking": return createBooking_(data);
    case "login": return login_(data);
    case "logout":
      if (token) CacheService.getScriptCache().remove(sessionKey_(token));
      return { ok: true };
    case "saveContent":
      requireAdmin_(token);
      return saveContent_(data);
    case "uploadImage":
      requireAdmin_(token);
      return uploadImage_(data);
    case "saveSettings":
      requireAdmin_(token);
      return saveSettings_(data);
    case "listContent":
      requireAdmin_(token);
      return listContent_();
    case "deleteContent":
      requireAdmin_(token);
      return deleteContent_(data);
    case "listUsers":
      requireAdmin_(token);
      return listUsers_();
    case "createUser":
      requireAdmin_(token);
      return createUser_(data);
    case "setUserState":
      return setUserState_(data, requireAdmin_(token));
    case "importNews":
      requireAdmin_(token);
      return importNews_(data);
    default: throw new Error("Chức năng không được hỗ trợ.");
  }
}

function publicData_() {
  const ss = spreadsheet_();
  const cms = supabasePublicData_();
  return {
    ok: true,
    services: rowsAsObjects_(ss, "Services").filter(function (row) {
      return isActive_(row.status);
    }).map(function (row) {
      return { id: row.id || "", name: row.name || "", price: row.price || "", description: row.description || "", status: row.status || "" };
    }),
    posts: cms.posts,
    reviews: cms.reviews,
    gallery: cms.gallery,
    settings: settings_()
  };
}

function createBooking_(data) {
  if (clean_(data.website, 200)) throw new Error("Không thể gửi yêu cầu.");
  const name = clean_(data.customer_name, 100);
  const phone = clean_(data.customer_phone, 20);
  const digits = phone.replace(/\D/g, "");
  const date = clean_(data.service_time, 20);
  const location = clean_(data.location_text, 180);
  const note = clean_(data.note, 800);
  const serviceDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00") : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!name || digits.length < 8 || digits.length > 15 || !serviceDate || isNaN(serviceDate.getTime()) || serviceDate < today || !location) {
    throw new Error("Vui lòng kiểm tra họ tên, số điện thoại, ngày sử dụng và địa điểm.");
  }
  const ss = spreadsheet_();
  const serviceRows = rowsAsObjects_(ss, "Services").filter(function (row) {
    return isActive_(row.status);
  });
  const id = clean_(data.service_id, 80);
  let service = serviceRows.find(function (row) { return row.id === id; });
  if (id && !service) throw new Error("Dịch vụ đã thay đổi. Vui lòng tải lại trang và chọn lại.");
  if (!service && data.service_name) {
    const requested = clean_(data.service_name, 120);
    service = serviceRows.find(function (row) { return row.name === requested; });
  }
  const serviceName = service ? clean_(service.name, 120) : clean_(data.service_name, 120);
  if (!serviceName) throw new Error("Vui lòng chọn dịch vụ hoặc ghi nhu cầu trong phần ghi chú.");
  const price = service ? String(service.price || "") : "";
  const amount = parseAmount_(price);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const phoneKey = "web_booking_" + sha256Hex_(digits);
    if (CacheService.getScriptCache().get(phoneKey)) {
      throw new Error("Bạn vừa gửi yêu cầu. Vui lòng chờ ít phút hoặc gọi hotline để bổ sung.");
    }
    const sheet = ensureSheet_(ss, "Bookings", CONFIG.bookingHeaders);
    const bookingId = nextBookingId_(sheet);
    const now = new Date().toISOString();
    const servicesInfo = JSON.stringify([{ id: service ? service.id : "", name: serviceName, price: amount, qty: 1 }]);
    appendByHeaders_(sheet, CONFIG.bookingHeaders, {
      id: bookingId,
      created_at: now,
      customer_name: name,
      customer_phone: "'" + phone.replace(/^'+/, ""),
      services_info: servicesInfo,
      service_time: date,
      install_time: "",
      collect_time: "",
      location_text: location,
      gps_location: "",
      map_link: "",
      note: note,
      total_cost: amount,
      paid_amount: 0,
      submitted_to_company: "FALSE",
      debt_amount: amount,
      require_invoice: "FALSE",
      invoice_info: "",
      status: "Chưa giao",
      assigned_user: "KH đặt Online",
      created_by: "KH đặt Online",
      updated_by: "KH đặt Online",
      updated_at: now
    });
    CacheService.getScriptCache().put(phoneKey, "1", 60);
    return { ok: true, id: bookingId };
  } finally {
    lock.releaseLock();
  }
}

function login_(data) {
  const username = clean_(data.username, 50).toLowerCase();
  const password = String(data.password || "");
  if (!username || !password || password.length > 200) throw new Error("Vui lòng nhập tài khoản và mật khẩu.");
  const user = rowsAsObjects_(spreadsheet_(), "Users").find(function (row) {
    return String(row.username || "").trim().toLowerCase() === username;
  });
  if (!user || !isActive_(user.is_active) || !verifyPassword_(password, String(user.password || ""))) {
    throw new Error("Tài khoản hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.");
  }
  const role = String(user.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (role !== "admin" && role !== "super_admin") throw new Error("Tài khoản chưa được cấp quyền quản trị.");
  const token = Utilities.getUuid() + Utilities.getUuid();
  const safeUser = { id: user.id || "", username: user.username || "", full_name: user.full_name || "", role: role };
  CacheService.getScriptCache().put(sessionKey_(token), JSON.stringify(safeUser), CONFIG.sessionSeconds);
  return { ok: true, token: token, user: safeUser };
}

function requireAdmin_(token) {
  if (!token || token.length > 100) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const cached = CacheService.getScriptCache().get(sessionKey_(token));
  if (!cached) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const session = JSON.parse(cached);
  const user = rowsAsObjects_(spreadsheet_(), "Users").find(function (row) {
    return String(row.id || "") === String(session.id || "") && isActive_(row.is_active);
  });
  if (!user) throw new Error("Tài khoản đã bị khóa hoặc không còn tồn tại.");
  const role = String(user.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (role !== "admin" && role !== "super_admin") throw new Error("Bạn không có quyền thực hiện thao tác này.");
  CacheService.getScriptCache().put(sessionKey_(token), JSON.stringify(session), CONFIG.sessionSeconds);
  return session;
}

function saveContent_(data) {
  const type = clean_(data.type, 20);
  if (type === "setting") {
    const key = clean_(data.key, 50).toLowerCase();
    if (PUBLIC_SETTING_KEYS.indexOf(key) < 0) throw new Error("Hãy dùng một khóa thông tin doanh nghiệp được hỗ trợ.");
    saveSettings_({ settings: { [key]: data.value } });
    return { ok: true };
  }
  if (type === "service") return saveService_(data);
  const mapping = {
    post: true,
    review: true,
    gallery: true
  }[type];
  if (!mapping) throw new Error("Loại nội dung không hợp lệ.");
  const id = clean_(data.id, 100) || Utilities.getUuid();
  const row = { id: id, kind: type, status: "published", updated_at: new Date().toISOString() };
  if (type === "post") {
    row.title = clean_(data.title, 150);
    row.summary = clean_(data.summary, 500);
    row.content = clean_(data.content, 10000);
    row.url = cleanHttpUrl_(data.url, 1000);
    row.image_url = cleanHttpsUrl_(data.image_url, 1000);
    if (!row.title || !row.content) throw new Error("Tiêu đề và nội dung bài viết không được để trống.");
  } else if (type === "review") {
    row.title = clean_(data.title, 150);
    row.author = clean_(data.author, 100);
    row.content = clean_(data.content, 2000);
    if (!row.author || !row.content) throw new Error("Tên khách hàng và nội dung đánh giá không được để trống.");
  } else if (type === "gallery") {
    row.title = clean_(data.title, 150);
    row.image_url = cleanHttpsUrl_(data.image_url, 1000);
    if (!row.title || !row.image_url) throw new Error("Tên ảnh và ảnh đã tải lên là bắt buộc.");
  }
  supabaseRequest_("website_content?on_conflict=id", "post", row, "resolution=merge-duplicates,return=representation");
  return { ok: true, id: id };
}

function saveService_(data) {
  const ss = spreadsheet_();
  const headers = ["id", "name", "price", "description", "status"];
  const sheet = ensureSheet_(ss, "Services", headers);
  const id = clean_(data.id, 100) || Utilities.getUuid();
  const existing = findRecordRow_(sheet, id);
  const row = {
    id: id,
    name: clean_(data.name, 150),
    price: clean_(data.price, 50),
    description: clean_(data.description, 1000),
    status: existing && !isActive_(existing.status) ? "Hoạt động" : (existing ? existing.status : "Hoạt động")
  };
  if (!row.name) throw new Error("Tên dịch vụ không được để trống.");
  writeRecord_(sheet, headers, row, existing);
  return { ok: true, id: id };
}

function listContent_() {
  migrateLegacyContentOnce_();
  const ss = spreadsheet_();
  const records = supabaseRequest_("website_content?select=*&order=created_at.desc", "get") || [];
  return {
    ok: true,
    posts: records.filter(function (row) { return row.kind === "post"; }),
    reviews: records.filter(function (row) { return row.kind === "review"; }),
    gallery: records.filter(function (row) { return row.kind === "gallery"; }),
    services: pickFields_(rowsAsObjects_(ss, "Services"), ["id", "name", "price", "description", "status"]),
    settings: settings_()
  };
}

function saveSettings_(data) {
  const values = data.settings;
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Dữ liệu thông tin trang không hợp lệ.");
  const rows = Object.keys(values).map(function (key) {
    if (PUBLIC_SETTING_KEYS.indexOf(key) < 0) throw new Error("Có khóa thông tin trang không được hỗ trợ.");
    return { key: key, value: clean_(values[key], 2000), updated_at: new Date().toISOString() };
  });
  if (rows.length) supabaseRequest_("website_settings?on_conflict=key", "post", rows, "resolution=merge-duplicates");
  return { ok: true };
}

function pickFields_(rows, fields) {
  return rows.map(function (row) {
    const result = {};
    fields.forEach(function (field) { result[field] = row[field] || ""; });
    return result;
  });
}

function deleteContent_(data) {
  const type = clean_(data.type, 20);
  const id = clean_(data.id, 100);
  if (type === "service") return deleteService_(id);
  if (["post", "review", "gallery"].indexOf(type) < 0 || !id) {
    throw new Error("Loại nội dung hoặc mã bản ghi không hợp lệ.");
  }
  const existing = supabaseRequest_(
    "website_content?id=eq." + encodeURIComponent(id) + "&kind=eq." + encodeURIComponent(type) + "&select=id,image_url",
    "get"
  );
  if (!existing || !existing.length) throw new Error("Không tìm thấy nội dung cần xóa.");
  const rows = supabaseRequest_(
    "website_content?id=eq." + encodeURIComponent(id) + "&kind=eq." + encodeURIComponent(type),
    "delete",
    null,
    "return=representation"
  );
  if (!rows || !rows.length) throw new Error("Không tìm thấy nội dung cần xóa.");
  const warning = existing[0].image_url
    ? deleteUnusedStorageImage_(id, String(existing[0].image_url))
    : "";
  return { ok: true, warning: warning };
}

function deleteService_(id) {
  if (!id) throw new Error("Thiếu mã dịch vụ.");
  const mapping = {
    sheet: "Services",
    headers: ["id", "name", "price", "description", "status"]
  };
  const sheet = ensureSheet_(spreadsheet_(), mapping.sheet, mapping.headers);
  const existing = findRecordRow_(sheet, id);
  if (!existing) throw new Error("Không tìm thấy nội dung cần xóa.");
  const statusColumn = findColumn_(existing.headers, sheet.getName(), "status");
  if (statusColumn < 0) throw new Error("Không tìm thấy cột trạng thái dịch vụ.");
  sheet.getRange(existing.rowNumber, statusColumn + 1).setValue("Ngừng");
  return { ok: true };
}

function createUser_(data) {
  const username = clean_(data.username, 50).trim();
  const password = String(data.password || "");
  const fullName = clean_(data.full_name, 100);
  const phone = clean_(data.phone, 20);
  const role = clean_(data.role, 20);
  if (!/^[\p{L}\p{N}._-]{3,50}$/u.test(username)) throw new Error("Tên đăng nhập cần từ 3–50 ký tự (chữ, số, dấu chấm, gạch dưới hoặc gạch ngang).");
  if (password.length < 8 || password.length > 200) throw new Error("Mật khẩu mới cần từ 8 ký tự.");
  if (role !== "admin" && role !== "user") throw new Error("Quyền người dùng không hợp lệ.");
  const sheet = ensureSheet_(spreadsheet_(), "Users", CONFIG.userHeaders);
  const users = rowsAsObjects_(spreadsheet_(), "Users");
  if (users.some(function (row) { return String(row.username || "").trim().toLowerCase() === username.toLowerCase(); })) {
    throw new Error("Tên đăng nhập đã tồn tại.");
  }
  const numericIds = users.map(function (row) {
    const match = String(row.id || "").match(/^U(\d+)$/i);
    return match ? Number(match[1]) : 0;
  });
  appendByHeaders_(sheet, CONFIG.userHeaders, {
    id: "U" + String(Math.max(0, ...numericIds) + 1),
    username: username,
    password: sha256Hex_(password),
    role: role,
    full_name: fullName,
    phone: phone,
    created_at: new Date().toISOString(),
    is_active: "Hoạt động",
    must_change_password: "TRUE",
    reset_requested: ""
  });
  return { ok: true };
}

function setUserState_(data, actor) {
  const id = clean_(data.id, 80);
  const active = data.active === true;
  if (!id) throw new Error("Thiếu mã người dùng.");
  const sheet = spreadsheet_().getSheetByName("Users");
  if (!sheet) throw new Error("Không tìm thấy danh sách người dùng.");
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(function (value) { return String(value).trim(); });
  const idColumn = findColumn_(headers, "Users", "id");
  const activeColumn = findColumn_(headers, "Users", "is_active");
  if (idColumn < 0 || activeColumn < 0) throw new Error("Tab Users thiếu cột id hoặc is_active.");
  if (!active && id === String(actor.id || "")) throw new Error("Bạn không thể tự khóa tài khoản đang đăng nhập.");
  if (!active) {
    const activeAdmins = rowsAsObjects_(spreadsheet_(), "Users").filter(function (row) {
      const role = String(row.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      return isActive_(row.is_active) && (role === "admin" || role === "super_admin");
    });
    const target = rowsAsObjects_(spreadsheet_(), "Users").find(function (row) { return String(row.id || "") === id; });
    const targetRole = String(target && target.role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (target && (targetRole === "admin" || targetRole === "super_admin") && activeAdmins.length <= 1) {
      throw new Error("Không thể khóa tài khoản quản trị viên đang hoạt động cuối cùng.");
    }
  }
  for (let index = 1; index < values.length; index++) {
    if (values[index][idColumn] === id) {
      sheet.getRange(index + 1, activeColumn + 1).setValue(active ? "Hoạt động" : "Khóa");
      return { ok: true };
    }
  }
  throw new Error("Không tìm thấy người dùng.");
}

function listUsers_() {
  return {
    ok: true,
    users: rowsAsObjects_(spreadsheet_(), "Users").map(function (row) {
      return {
        id: row.id || "",
        username: row.username || "",
        full_name: row.full_name || "",
        role: row.role || "user",
        is_active: isActive_(row.is_active)
      };
    })
  };
}

function importNews_(data) {
  const url = clean_(data.url, 300) || CONFIG.sourceSite;
  if (url !== CONFIG.sourceSite) throw new Error("Chỉ cho phép nhập từ website đã cấu hình.");
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error("Không tải được bài viết từ Google Sites.");
  const html = response.getContentText();
  const titles = [];
  const pattern = /<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null && titles.length < 20) {
    const title = clean_(match[1].replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " "), 150);
    if (title && titles.indexOf(title) < 0 && title.length > 5) titles.push(title);
  }
  if (!titles.length) throw new Error("Không tìm thấy tiêu đề bài viết công khai. Hãy thêm nội dung thủ công.");
  titles.forEach(function (title) {
    saveContent_({
      type: "post",
      title: title,
      summary: "Bài viết được nhập từ Google Sites.",
      content: title,
      url: url
    });
  });
  return { ok: true, imported: titles.length };
}

function settings_() {
  const result = {};
  const rows = supabaseRequest_("website_settings?select=key,value", "get") || [];
  rows.forEach(function (row) {
    const key = String(row.key || "");
    if (PUBLIC_SETTING_KEYS.indexOf(key) >= 0) result[key] = String(row.value || "");
  });
  return result;
}

function migrateLegacyContentOnce_() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("SUPABASE_CONTENT_MIGRATED") === "true") return;
  const ss = spreadsheet_();
  const collections = [
    { sheet: "WebsitePosts", kind: "post" },
    { sheet: "WebsiteReviews", kind: "review" },
    { sheet: "WebsiteGallery", kind: "gallery" }
  ];
  collections.forEach(function (collection) {
    const records = rowsAsObjects_(ss, collection.sheet).map(function (item) {
      const row = {
        id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(item.id || ""))
          ? String(item.id)
          : Utilities.getUuid(),
        kind: collection.kind,
        title: clean_(item.title, 150),
        summary: clean_(item.summary, 500),
        content: clean_(item.content, 10000),
        url: cleanHttpUrl_(item.url, 1000),
        image_url: cleanHttpsUrl_(item.image_url, 1000),
        author: clean_(item.author, 100),
        status: isActiveRow_(item) ? "published" : "draft"
      };
      if (/^\d{4}-\d{2}-\d{2}T/.test(String(item.created_at || ""))) {
        row.created_at = item.created_at;
        row.updated_at = item.created_at;
      }
      return row;
    });
    if (records.length) {
      supabaseRequest_("website_content?on_conflict=id", "post", records, "resolution=merge-duplicates");
    }
  });
  const settings = {};
  rowsAsObjects_(ss, "Settings").forEach(function (row) {
    const key = String(row.key || "").trim().toLowerCase();
    if (PUBLIC_SETTING_KEYS.indexOf(key) >= 0) settings[key] = row.value || "";
  });
  const settingRows = Object.keys(settings).map(function (key) {
    return { key: key, value: clean_(settings[key], 2000) };
  });
  if (settingRows.length) {
    supabaseRequest_("website_settings?on_conflict=key", "post", settingRows, "resolution=merge-duplicates");
  }
  properties.setProperty("SUPABASE_CONTENT_MIGRATED", "true");
}

function supabasePublicData_() {
  const fields = "select=id,kind,title,summary,content,url,image_url,author,created_at,status";
  function published(kind, limit) {
    return supabaseRequest_(
      "website_content?" + fields + "&kind=eq." + kind + "&status=eq.published&order=created_at.desc&limit=" + limit,
      "get"
    ) || [];
  }
  return {
    posts: published("post", 12),
    reviews: published("review", 12),
    gallery: published("gallery", 24)
  };
}

function uploadImage_(data) {
  const mimeType = clean_(data.mimeType, 50).toLowerCase();
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  if (!extensions[mimeType]) throw new Error("Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF.");
  const base64 = String(data.base64 || "").replace(/^data:[^,]+;base64,/, "");
  if (!base64 || base64.length > 5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("Ảnh không hợp lệ hoặc vượt quá 4 MB.");
  }
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > 4194304) throw new Error("Ảnh không được vượt quá 4 MB.");
  const fileName = Utilities.getUuid() + "." + extensions[mimeType];
  const endpoint = supabaseConfig_().url + "/storage/v1/object/website-images/" + fileName;
  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: mimeType,
    payload: Utilities.newBlob(bytes, mimeType, fileName),
    headers: supabaseHeaders_(),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("Không tải được ảnh lên Supabase (HTTP " + status + ").");
  }
  return {
    ok: true,
    url: supabaseConfig_().url + "/storage/v1/object/public/website-images/" + fileName
  };
}

function deleteUnusedStorageImage_(deletedId, imageUrl) {
  const config = supabaseConfig_();
  const publicPrefix = config.url + "/storage/v1/object/public/website-images/";
  if (imageUrl.indexOf(publicPrefix) !== 0) return "";
  const path = imageUrl.slice(publicPrefix.length);
  if (!/^[a-zA-Z0-9._-]+$/.test(path)) return "Nội dung đã xóa; URL ảnh không hợp lệ nên chưa thể dọn tệp trong kho.";
  try {
    const references = supabaseRequest_(
      "website_content?select=id&image_url=eq." + encodeURIComponent(imageUrl) +
        "&id=neq." + encodeURIComponent(deletedId) + "&limit=1",
      "get"
    ) || [];
    if (references.length) return "";
    const response = UrlFetchApp.fetch(
      config.url + "/storage/v1/object/website-images/" + path,
      { method: "delete", headers: supabaseHeaders_(), muteHttpExceptions: true }
    );
    const status = response.getResponseCode();
    return status >= 200 && status < 300
      ? ""
      : "Nội dung đã xóa nhưng tệp ảnh chưa được dọn khỏi Supabase Storage (HTTP " + status + ").";
  } catch (error) {
    return "Nội dung đã xóa nhưng ảnh chưa được dọn khỏi Supabase Storage: " + safeMessage_(error);
  }
}

function supabaseConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const url = String(properties.getProperty("SUPABASE_URL") || "").replace(/\/+$/, "");
  const key = String(properties.getProperty("SUPABASE_SECRET_KEY") || "");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) {
    throw new Error("Chưa cấu hình SUPABASE_URL và SUPABASE_SECRET_KEY trong Script Properties.");
  }
  return { url: url, key: key };
}

function supabaseHeaders_() {
  const config = supabaseConfig_();
  return {
    apikey: config.key
  };
}

function supabaseRequest_(path, method, payload, prefer) {
  const config = supabaseConfig_();
  const options = {
    method: method,
    headers: supabaseHeaders_(),
    muteHttpExceptions: true
  };
  if (payload !== null && payload !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  if (prefer) options.headers.Prefer = prefer;
  const response = UrlFetchApp.fetch(config.url + "/rest/v1/" + path, options);
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Supabase từ chối yêu cầu (HTTP " + status + "): " + clean_(body, 160));
  }
  return body ? JSON.parse(body) : null;
}

function authorizeSupabase() {
  const rows = supabaseRequest_("website_content?select=id&limit=1", "get") || [];
  console.log("Supabase connection authorized; content rows: " + rows.length);
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || CONFIG.spreadsheetId;
  if (!id) throw new Error("Chưa cấu hình SHEET_ID trong Apps Script project settings.");
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
    const missing = headers.filter(function (header) { return findColumn_(current, name, header) < 0; });
    if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

function rowsAsObjects_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(function (value) { return String(value).trim(); });
  return values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ""; });
  }).map(function (row) {
    const result = {};
    headers.forEach(function (header, index) {
      result[header] = row[index] || "";
      const canonical = canonicalHeader_(name, header);
      if (canonical) result[canonical] = row[index] || "";
    });
    return result;
  });
}

function appendByHeaders_(sheet, canonicalHeaders, object) {
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
  const headers = currentHeaders.length ? currentHeaders : canonicalHeaders;
  const sheetName = sheet.getName();
  const values = headers.map(function (header) {
    const key = canonicalHeader_(sheetName, header) || header;
    return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : "";
  });
  sheet.appendRow(values);
}

function findRecordRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return null;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
  const idColumn = findColumn_(headers, sheet.getName(), "id");
  if (idColumn < 0) throw new Error("Không tìm thấy cột mã nội dung.");
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][idColumn]).trim() === id) {
      const object = {};
      headers.forEach(function (header, column) {
        const key = canonicalHeader_(sheet.getName(), header) || header;
        object[key] = values[index][column] || "";
      });
      return { rowNumber: index + 2, headers: headers, created_at: object.created_at || "", status: object.status || "" };
    }
  }
  return null;
}

function writeRecord_(sheet, canonicalHeaders, object, existing) {
  if (!existing) {
    appendByHeaders_(sheet, canonicalHeaders, object);
    return;
  }
  const sheetName = sheet.getName();
  Object.keys(object).forEach(function (key) {
    const column = findColumn_(existing.headers, sheetName, key);
    if (column >= 0) sheet.getRange(existing.rowNumber, column + 1).setValue(object[key]);
  });
}

function upsertByKey_(sheet, keyHeader, valueHeader, key, value) {
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(function (item) { return String(item).trim(); });
  const keyColumn = findColumn_(headers, sheet.getName(), keyHeader);
  const valueColumn = findColumn_(headers, sheet.getName(), valueHeader);
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][keyColumn]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      sheet.getRange(row + 1, valueColumn + 1).setValue(value);
      return;
    }
  }
  appendByHeaders_(sheet, [keyHeader, valueHeader], { key: key, value: value });
}

function cleanHttpUrl_(value, maxLength) {
  const url = clean_(value, maxLength);
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) throw new Error("URL cần bắt đầu bằng http:// hoặc https://.");
  return url;
}

function cleanHttpsUrl_(value, maxLength) {
  const url = clean_(value, maxLength);
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) throw new Error("Ảnh cần có URL công khai bắt đầu bằng https://.");
  return url;
}

function nextBookingId_(sheet) {
  let max = 1000;
  if (sheet.getLastRow() > 1) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const idColumn = findColumn_(headers, sheet.getName(), "id");
    if (idColumn >= 0) {
      sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(function (row) {
        const match = String(row[0]).match(/^TL(\d+)$/i);
        if (match) max = Math.max(max, Number(match[1]));
      });
    }
  }
  return "TL" + String(max + 1);
}

function verifyPassword_(plain, stored) {
  const value = stored.trim();
  if (/^[a-f0-9]{64}$/i.test(value)) return sha256Hex_(plain) === value.toLowerCase();
  return plain === value;
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function (byte) { return (byte + 256).toString(16).slice(-2); }).join("");
}

function sessionKey_(token) {
  return "web_admin_" + sha256Hex_(token);
}

function parseAmount_(value) {
  const digits = String(value || "").replace(/[^\d-]/g, "");
  return digits ? Number(digits) : 0;
}

function isActive_(value) {
  return !/^(false|0|khóa|khoá|bị khóa|ngưng|ngừng|ngưng hoạt động|ngừng hoạt động|tạm ngưng|inactive|locked|không hoạt động)$/i.test(String(value || "").trim());
}

function isActiveRow_(row) {
  return isActive_(row.status);
}

function newestFirst_(left, right) {
  return String(right.created_at || "").localeCompare(String(left.created_at || ""));
}

function clean_(value, maxLength) {
  return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function safeMessage_(error) {
  return error && error.message ? String(error.message).slice(0, 250) : "Đã xảy ra lỗi khi xử lý yêu cầu.";
}
