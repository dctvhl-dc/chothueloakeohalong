# Cho Thuê Loa Kéo Hạ Long

Website tĩnh tiếng Việt, responsive trên điện thoại và máy tính, được thiết kế để xuất bản miễn phí bằng GitHub Pages. Frontend không cần Node, database riêng hoặc build bước trước khi deploy.

## Thành phần

- `index.html`, `styles.css`, `app.js`: trang giới thiệu, dịch vụ, form đặt thuê, tin tức, đánh giá, bộ sưu tập, liên hệ và khu vực quản trị.
- `apps-script/Code.gs`: API trung gian đọc dịch vụ, ghi đơn và xác thực quản trị bằng Google Sheets; chuyển nội dung website và ảnh sang Supabase.
- `apps-script/appsscript.json`: các quyền OAuth cần cho Google Sheets, Google Drive và kết nối Supabase.
- `supabase/schema.sql`: bảng nội dung/trang, chính sách đọc công khai và bucket lưu ảnh.
- `.github/workflows/pages.yml`: tự động xuất bản các tệp tĩnh khi push lên nhánh `main`.

Các tệp giao diện được phục vụ tĩnh từ GitHub Pages. GitHub Pages không cung cấp database hoặc nơi tải ảnh lên; dữ liệu CMS và ảnh được lưu ở Supabase Free. Không đưa khóa Supabase bí mật vào GitHub hoặc trình duyệt.

## 1. Tạo database và kho ảnh Supabase miễn phí

1. Tạo organization và project Supabase theo gói **Free**. Với website ở Việt Nam, chọn khu vực gần nhất có sẵn (thường là Singapore).
2. Trong project, mở **SQL Editor → New query**, dán và chạy toàn bộ nội dung `supabase/schema.sql`. Việc này tạo bảng bài viết/đánh giá/thư viện, cài quyền đọc công khai có RLS, và tạo bucket ảnh công khai `website-images`. Chỉ URL ảnh được công khai; thao tác tải lên vẫn được khóa bằng phiên quản trị.
3. Mở **Project Settings → API Keys** và lấy Project URL cùng **Secret API key** (`sb_secret_...`). Secret key có toàn quyền trên database/bucket: chỉ lưu trong Apps Script Script Properties, tuyệt đối không đặt vào `config.js`, `app.js`, HTML, GitHub Actions hoặc gửi cho người khác. Không dùng khóa cũ `service_role` (Supabase đang ngừng hỗ trợ nhóm khóa cũ).
4. Trong Apps Script project, vào **Project Settings → Script properties**, thêm:
   - `SUPABASE_URL`: Project URL dạng `https://<project-ref>.supabase.co`
   - `SUPABASE_SECRET_KEY`: Secret API key (`sb_secret_...`)
5. Nếu khóa bị lộ, lập tức xoay (rotate) khóa trong Supabase và cập nhật Script Property.

Ảnh tải từ CMS được lưu vào Supabase Storage, bucket `website-images`; hệ thống tự tạo URL HTTPS công khai và ghi URL đó vào nội dung trong PostgreSQL. Giới hạn mỗi ảnh 4 MB, định dạng JPEG, PNG, WebP hoặc GIF.

## 2. Kết nối Google Sheets

1. Mở [Google Apps Script](https://script.google.com/), tạo một project do tài khoản có quyền truy cập vào spreadsheet sở hữu.
2. Dán nội dung `apps-script/Code.gs` vào `Code.gs`. Trong **Project Settings**, bật hiển thị tệp kê khai `appsscript.json` và thay nội dung bằng `apps-script/appsscript.json`.
3. Mở **Project Settings → Script properties**, thêm (giữ cả các thuộc tính Supabase ở trên):
   - Property: `SHEET_ID`
   - Value: ID của spreadsheet mà ứng dụng `dc_tech_rental` đang sử dụng.
4. Lưu project, chọn hàm `authorizeSupabase` trong editor rồi bấm **Run**. Tài khoản sở hữu Apps Script phải chấp thuận các quyền được yêu cầu để backend gọi Supabase. Nếu không thấy hộp thoại quyền, mở liên kết **Nhấp vào đây để cấp quyền** trong nhật ký thực thi.
5. Chọn **Deploy → New deployment → Web app**, đặt **Execute as: Me** và cấp quyền truy cập công khai (**Anyone**) để khách có thể gửi yêu cầu thuê.
6. Sao chép URL triển khai có đuôi `/exec`. Không công khai Apps Script editor cho khách.
7. Điền URL triển khai vào `apiUrl` trong `config.js`, rồi push lại để publish. Đây là URL public của API, không phải credential. Cấu hình này là bắt buộc để mọi khách truy cập trên thiết bị khác nhau đều tải được dịch vụ và gửi đơn.
   - Nếu cần thử riêng trên một máy, có thể dán URL ở **Quản trị**. URL đó chỉ được lưu trong `localStorage` của trình duyệt hiện tại; nó không thay thế bước cấu hình `config.js` cho khách.
8. Kiểm tra API đọc công khai bằng cách mở URL này, thay `WEB_APP_URL` bằng URL `/exec`:
   `WEB_APP_URL?action=public&callback=loaCallback_123_1`
   Kết quả phải là một lệnh gọi callback JavaScript có `ok: true`.

Sau lần chuyển dữ liệu cũ (nếu có), ứng dụng chỉ đọc/ghi các tab `Services`, `Bookings`, `Users` của Google Sheets. Nội dung trang, bài viết, đánh giá, thư viện ảnh lưu ở Supabase; ảnh giao/thu trong tab `Photos` của ứng dụng không được đưa công khai lên web. Thông tin giới thiệu/liên hệ lưu trong bảng `website_settings`. Lần đầu admin mở CMS sau khi cấu hình Supabase sẽ tự chuyển các bài viết, đánh giá, ảnh và cài đặt cũ trong Google Sheets sang database một lần.

Đơn web ghi vào `Bookings` với `status = Chưa giao`, người tạo/người phụ trách `KH đặt Online`, số điện thoại giữ số 0 đầu và `services_info` ở dạng JSON tương thích ứng dụng.

## 3. Thiết lập tài khoản quản trị

Tạo/kiểm tra user trong tab `Users` của app. User phải đang hoạt động và có role `admin` hoặc `super_admin`. Có thể tạo tài khoản quản trị đầu tiên bằng công cụ quản lý người dùng của app. Đăng nhập website bằng chính username/password đó.

Trong khu vực quản trị website:

- **Bài viết:** tạo, xem danh sách, sửa và xóa bài; nhập tiêu đề, mô tả, nội dung, liên kết và ảnh bìa HTTPS.
- **Đánh giá:** thêm, sửa, xóa tên khách hàng, dịch vụ và nội dung đánh giá.
- **Thư viện ảnh:** chọn tệp ảnh để tải trực tiếp lên Supabase Storage; URL được tạo và lưu tự động. Ảnh bìa bài viết cũng dùng kho này.
- **Dịch vụ:** thêm/sửa thông tin và giá dịch vụ. “Ngừng dịch vụ” sẽ ẩn dịch vụ khỏi trang đặt thuê nhưng giữ dữ liệu trong lịch sử đơn.
- **Thông tin trang:** sửa tên doanh nghiệp, hotline, địa chỉ, khu vực phục vụ, giờ phục vụ, email và các đoạn giới thiệu/định hướng.
- **Người dùng:** tạo tài khoản `admin`/`user` và khóa/mở khóa user. Không thể tự khóa tài khoản hiện tại hoặc khóa admin đang hoạt động cuối cùng.
- **Lấy bài viết từ Google Sites:** nhập tiêu đề h1/h2 công khai thành bài viết liên kết về trang gốc; có thể chỉnh nội dung nhập sau đó. Nếu Google Sites không trả tiêu đề trong HTML công khai, hãy thêm bài thủ công.

Sau khi cập nhật `apps-script/Code.gs`, phải dán mã mới vào Apps Script project và cập nhật deployment Web app bằng **Deploy → Manage deployments → Edit → New version → Deploy**. Push frontend lên GitHub sẽ không tự cập nhật Apps Script.

Mật khẩu mới được lưu SHA-256, không gửi mật khẩu/hash xuống endpoint đọc công khai. Đăng nhập tạo token thời hạn tối đa 6 giờ. Tab `Users` hiện có thể chứa mật khẩu thô do cơ chế tương thích của app; nên đăng nhập và đổi các mật khẩu cũ sang mật khẩu mới để chúng được lưu hash. Dùng mật khẩu riêng, mạnh cho từng tài khoản.

## 4. Đưa website lên GitHub Pages

1. Tạo repository mới trên GitHub, ví dụ `web-cho-thue-loa`. Nếu dùng GitHub Free, chọn **Public** để dùng Pages miễn phí. Lý tưởng nhất là không chọn tạo README, `.gitignore` hoặc license vì thư mục website đã có sẵn các file đó. Nếu bạn đã tạo README trên GitHub thì vẫn dùng được — làm theo mục “Đã tạo repository/README trước” bên dưới.
2. Nếu đã triển khai Apps Script, điền URL `/exec` vào `apiUrl` trong `config.js` trước khi đưa mã lên GitHub. Nếu chưa điền, trang mẫu vẫn mở nhưng khách chưa thể tải dịch vụ hoặc gửi đơn.
3. Mở PowerShell và chạy các lệnh sau. Thay `<USERNAME>` và `<REPO>` bằng tên tài khoản và repository bạn vừa tạo:

   ```powershell
   Set-Location "D:\Setup\Code\Web Loa keo"
   git init -b main
   git add .
   git commit -m "Initial Cho Thue Loa Keo Ha Long website"
   git remote add origin https://github.com/<USERNAME>/<REPO>.git
   git push -u origin main
   ```

   Nếu Git hỏi danh tính ở bước commit, cấu hình tên/email Git của bạn rồi chạy lại `git commit` và `git push`. Có thể thực hiện tương tự bằng GitHub Desktop nếu muốn thao tác bằng giao diện.
4. Trên GitHub, vào **repository → Settings → Pages**, đặt **Build and deployment → Source** thành **GitHub Actions**. Đây là chế độ phù hợp với workflow đã có tại `.github/workflows/pages.yml`.
5. Mở tab **Actions**, chờ workflow `Deploy static website to GitHub Pages` chạy xong với trạng thái thành công. Trong **Settings → Pages**, GitHub sẽ hiển thị địa chỉ mặc định dạng `https://<USERNAME>.github.io/<REPO>/`.

GitHub Pages công khai website cho mọi người, kể cả trong trường hợp repository riêng tư thuộc gói hỗ trợ Pages riêng tư. Không đưa mật khẩu, Service Account JSON, private key hoặc dữ liệu riêng tư vào repository hay website.

### Đã tạo repository hoặc README trên GitHub trước

Không xóa repository và không cần tạo lại. Để tránh lỗi do lịch sử GitHub đã có một commit README khác với thư mục website trên máy:

1. Clone repository GitHub vào **một thư mục mới, đang trống**. Ví dụ dùng GitHub Desktop: **File → Clone repository…**, chọn repository vừa tạo và đặt Local path là `D:\Setup\Code\Web Loa keo-github` (không clone đè lên thư mục website hiện tại).
2. Sao chép toàn bộ nội dung trong `D:\Setup\Code\Web Loa keo` sang `D:\Setup\Code\Web Loa keo-github`, cho phép ghi đè README mẫu của GitHub bằng README đầy đủ của website. Đảm bảo sao chép cả `.github` và `.nojekyll`.
3. Mở repository đã clone trong GitHub Desktop. Kiểm tra danh sách Changes có các file website, trong đó README là file đã sửa. Nhập Summary như `Add website files`, bấm **Commit to main**, rồi **Push origin**.
4. Tiếp tục với bước chọn GitHub Actions ở trên.

Có thể thay thao tác sao chép bằng PowerShell sau khi clone xong; lệnh này giữ thư mục `.git` của bản clone để kết nối đúng lịch sử repository:

```powershell
$source = "D:\Setup\Code\Web Loa keo"
$destination = "D:\Setup\Code\Web Loa keo-github"
Get-ChildItem -LiteralPath $source -Force |
  Where-Object { $_.Name -ne ".git" } |
  Copy-Item -Destination $destination -Recurse -Force
git -C $destination add .
git -C $destination commit -m "Add website files"
git -C $destination push
```

Sau khi push, tiếp tục làm việc trong thư mục clone `Web Loa keo-github` (hoặc dùng GitHub Desktop mở thư mục này), để các lần commit/push sau đi đúng repository.

## 4. Gán tên miền đang có vào GitHub Pages

Ví dụ bên dưới dùng tên miền gốc `tenmiencuaban.vn` và tên `www.tenmiencuaban.vn`. Thay bằng tên miền của bạn; giao diện DNS có thể đặt tên các trường khác nhau tùy nhà cung cấp tên miền.

1. **Nên xác minh quyền sở hữu tên miền trước.** Trên GitHub, mở **avatar → Settings → Pages**, chọn thêm tên miền cần xác minh. Thêm bản ghi TXT mà GitHub hiển thị vào phần DNS quản lý tên miền, đợi xác minh thành công rồi giữ lại TXT record đó. Bước này giúp ngăn người khác gán tên miền của bạn vào Pages.
2. Đảm bảo workflow Pages đã chạy thành công. Trong repository, vào **Settings → Pages → Custom domain**, nhập tên miền chính bạn chọn, ví dụ `tenmiencuaban.vn`, rồi bấm **Save**. Nhập tên miền thuần, không thêm `https://`, đường dẫn `/` hoặc tên repository.
3. Đăng nhập trang quản lý DNS nơi bạn mua/quản lý tên miền. Tạo các bản ghi sau để tên miền gốc trỏ đến GitHub Pages:

   | Loại | Tên/Host | Giá trị/Trỏ đến |
   | --- | --- | --- |
   | A | `@` (hoặc để trống nếu nhà cung cấp quy định như vậy) | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<USERNAME>.github.io` |

   Thay `<USERNAME>` bằng tên tài khoản **hoặc tổ chức** GitHub sở hữu Pages site. Không thêm tên repository vào giá trị CNAME. Nếu nhà cung cấp hỗ trợ IPv6, có thể thêm cả bốn bản ghi AAAA:
   `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

   Nếu nhà cung cấp DNS có loại `ALIAS`/`ANAME` và hướng dẫn riêng cho tên miền gốc, cũng có thể trỏ theo địa chỉ Pages mặc định thay cho các bản ghi A. Không tạo CNAME ở `@` trừ khi nhà cung cấp hỗ trợ ALIAS/ANAME hoặc flattening. Xóa bản ghi A/AAAA/CNAME mặc định hoặc cũ đang xung đột tại các host này; **không xóa MX/TXT đang dùng cho email**. Không tạo DNS wildcard `*`.
4. Đợi DNS cập nhật. Việc này thường nhanh nhưng có thể mất đến 24 giờ. Trên PowerShell Windows có thể kiểm tra:

   ```powershell
   Resolve-DnsName tenmiencuaban.vn -Type A
   Resolve-DnsName www.tenmiencuaban.vn -Type CNAME
   ```

   Kết quả A cần gồm bốn địa chỉ GitHub ở trên; CNAME của `www` cần trỏ thẳng tới `<USERNAME>.github.io`. Nếu đang dùng một dịch vụ DNS proxy/CDN, hãy tạm để record ở chế độ chỉ DNS trong lúc GitHub xác minh domain và cấp chứng chỉ.
5. Quay lại **repository → Settings → Pages**. Khi GitHub xác nhận cấu hình DNS đúng, đợi GitHub tạo chứng chỉ TLS. Sau đó bật **Enforce HTTPS**. Nếu nút này chưa bật được, tiếp tục chờ DNS/chứng chỉ cập nhật rồi kiểm tra lại; quá trình có thể mất đến 24 giờ. Khi đã gán cả tên miền gốc và `www`, GitHub tự chuyển hướng tên còn lại về tên miền chính bạn đặt ở bước 2.
6. Kiểm tra cả `https://tenmiencuaban.vn` và `https://www.tenmiencuaban.vn`; ổ khóa HTTPS phải xuất hiện. Từ đây, mỗi lần push cập nhật lên `main`, workflow sẽ tự xuất bản phiên bản mới trên tên miền.

**SSL/HTTPS miễn phí:** GitHub Pages tự cấp và gia hạn chứng chỉ TLS cho domain đã cấu hình đúng; bạn không cần mua, tải lên hoặc tự tạo chứng chỉ. HTTPS mã hóa đường truyền nhưng không biến GitHub Pages thành backend an toàn để lưu bí mật hay xử lý giao dịch nhạy cảm.

Nếu DNS đã đúng mà HTTPS không được cấp, kiểm tra xem domain có bản ghi CAA giới hạn nhà phát hành chứng chỉ hay không; nếu có, cần cho phép `letsencrypt.org`. Tham khảo thêm [hướng dẫn GitHub Pages về domain tùy chỉnh](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [xác minh domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages) và [HTTPS cho GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

GitHub Pages chỉ host frontend tĩnh. Không thêm service-account JSON, private key, mật khẩu Sheets hoặc thông tin đăng nhập quản trị vào `config.js`, HTML hay repository. Mã Apps Script công khai không chứa spreadsheet ID; ID chỉ được cấu hình trong Script Properties. Apps Script Web App chạy dưới quyền chủ sở hữu nên cần bảo vệ tài khoản Google sở hữu và chỉ cấp quyền chỉnh sửa spreadsheet/script cho người tin cậy.

## Chạy và kiểm tra cục bộ

Có thể mở `index.html` để xem giao diện tĩnh. Để kiểm tra kết nối Apps Script, phục vụ thư mục qua local HTTP server (không dùng `file://`) và điền URL `/exec` vào `config.js`. Nếu chưa kết nối API, trang vẫn hiển thị thông tin giới thiệu/dịch vụ mẫu và hotline; form sẽ báo rõ nếu chưa có endpoint hợp lệ.

### Cập nhật mã Apps Script sau khi sửa

Thay đổi trong `apps-script/Code.gs` **không tự cập nhật** project Google Apps Script đã triển khai:

1. Mở project Apps Script mà URL `/exec` đang trỏ tới, mở `Code.gs` và thay nội dung bằng phiên bản mới trong repository.
2. Trong **Project Settings → Script properties**, bảo đảm `SHEET_ID` đã được cấu hình; không chép ID spreadsheet vào mã nguồn công khai.
3. Chọn **Deploy → Manage deployments**, bấm biểu tượng bút chì ở deployment loại Web app, chọn **New version** rồi bấm **Deploy**. Dùng lại URL `/exec` hiện tại.
4. Nếu thay cả frontend, commit và push các file website lên nhánh `main`; GitHub Actions sẽ triển khai frontend mới.

Đăng nhập quản trị gửi form POST tới Apps Script trong iframe. Ứng dụng nhận thông điệp phản hồi từ frame sandbox của Google, vì vậy khi cập nhật phải đồng bộ cả `app.js` (kiểm tra origin phản hồi) và `apps-script/Code.gs` (chuyển tiếp postMessage về trang website).
