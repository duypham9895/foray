# Hướng dẫn

Một bài đi nhanh qua cách foray hoạt động, nó làm gì cho bạn, và dùng sao cho hiệu quả.

---

## foray là gì (và không phải gì)

foray là một phòng chỉ huy chiến dịch tìm việc. Mỗi sáng bạn bước vào, xem có gì mới, quyết định nước đi tiếp theo, rồi bước ra. Đây là một *nơi* — không phải một công cụ ghi chép.

Công cụ ghi chép thì thụ động — bạn phải nhập liệu cho nó. foray thì ngược lại: nó tự đọc hộp thư của bạn, ghi nhận những foray mới, và chỉ đưa lên một vài quyết định đang chờ bạn xử lý. Phần còn lại nằm ngoài tầm mắt.

---

## Buổi sáng của bạn, trong 3 phút

Mở trang **Hôm nay**. Ba phần, theo thứ tự áp lực:

1. **Cần quyết định** — những việc đang chờ bạn. Lời đề nghị chưa trả lời; email mà bộ phân loại chưa chắc. Một cú nhấp xác nhận phân loại; cú nhấp thứ hai mở foray đầy đủ.
2. **Phỏng vấn hôm nay** — bất cứ gì trên lịch hôm nay, lấy từ các vòng bạn đã thêm vào foray.
3. **Yên ắng** — foray nào chưa có động tĩnh hơn 7 ngày. Không đỏ, không ồn — chỉ là danh sách để lướt nhanh xem có muốn nhắc ai không.

Sidebar luôn hiển thị **đếm theo pipeline** — đã ứng tuyển, sàng lọc, phỏng vấn, đề nghị, đã đóng. Bạn có thể ngưng đọc ngay khi đã thấy điều cần thấy.

---

## Thêm một foray

Ba cách, tùy ngữ cảnh:

- **Từ bất cứ đâu — ⌘K**. Mở modal thêm nhanh với công ty, vị trí và URL. Dùng khi bạn đang ở trong app.
- **Bookmarklet**. Kéo nó từ Cài đặt vào thanh bookmark. Nhấp nó trên trang tuyển dụng; tiêu đề, URL và phần text đã bôi đen sẽ được điền sẵn vào foray mới.
- **Form đầy đủ** tại `/applications/new`. Cùng các trường, thêm khoảng lương, địa điểm, nguồn, ghi chú. Dùng khi bạn muốn ghi nhận chỉn chu.

Bạn không cần điền hết khi thêm. Vòng phỏng vấn, ghi chú, phần còn lại có thể thêm sau từ trang chi tiết của foray.

---

## Kết nối Gmail (và vì sao)

Trong Cài đặt, nhấn **Kết nối Gmail**. Màn hình OAuth sẽ xin quyền đọc hộp thư.

Sau khi kết nối:

- Một cron job đọc Gmail mỗi 15 phút.
- Mỗi email mới được phân loại — *từ chối*, *mời phỏng vấn*, *nhà tuyển dụng liên hệ*, *không liên quan*, hoặc *chưa khớp*.
- Phân loại có độ tin cậy cao (≥85%) tự động cập nhật trạng thái foray tương ứng. Bạn thấy chúng trong timeline.
- Phân loại độ tin cậy thấp đi vào **hàng chờ xem lại** trong `/inbox`, và ba mục đầu xuất hiện trên trang Hôm nay.

**Cái gì được lưu**: tiêu đề, người gửi và 500 ký tự đầu của mỗi email. Nội dung đầy đủ chỉ tải khi bạn mở dòng trong `/inbox`.

**Cảnh báo 7 ngày**: khi Gmail OAuth ở chế độ Test, Google có thể thu hồi refresh token sau bảy ngày. Nếu đồng bộ cũ, Cài đặt sẽ hiển thị banner cảnh báo và bạn kết nối lại.

---

## Hàng chờ xem lại

Khi bộ phân loại không chắc, email đến `/inbox` với dự đoán tốt nhất và phần trăm tin cậy. Bạn có bốn hành động cho mỗi dòng:

- **Đồng ý** — chấp nhận nhãn của bộ phân loại. Trạng thái foray cập nhật.
- **Thay đổi** — chọn nhãn đúng từ dropdown.
- **Liên kết với foray** — nếu bộ phân loại không khớp được foray và bạn biết nó thuộc foray nào.
- **Bỏ qua** — đánh dấu là không liên quan, không động vào foray nào.

Hàng chờ trống = bạn đã xử lý hết. Trang Hôm nay phản ánh điều đó bằng giọng điệu nhẹ nhàng hơn.

---

## Vòng phỏng vấn vs trạng thái chuẩn

Hai lớp trạng thái, có chủ đích:

- **Trạng thái chuẩn** là một trong sáu trạng thái cố định: đã ứng tuyển, sàng lọc, phỏng vấn, đề nghị, từ chối, đã rút. Dùng cho bộ lọc, cột kanban, dải pipeline — bất cứ đâu bạn so sánh giữa các foray.
- **Vòng phỏng vấn** thì tự do theo từng foray. "Recruiter call", "Tech round 2", "Bar raiser", "On-site". Mỗi công ty chạy quy trình khác nhau; vòng phỏng vấn cho phép bạn ghi nhận chính xác đang ở đâu.

Một foray có thể ở trạng thái chuẩn `phỏng vấn` trong khi vòng hiện tại là "Tech round 2 of 3". Hai thứ trả lời câu hỏi khác nhau: trạng thái là "đang ở đâu trong pipeline?", vòng là "đang ở đâu trong quy trình của công ty này?".

---

## Mẹo dùng nhanh

- **⌘K** từ bất cứ đâu → modal thêm nhanh
- **Nhấp một thẻ trên bảng** → trang chi tiết foray với timeline + ghi chú
- **Lọc theo trạng thái** trên `/applications` → URL là nguồn sự thật, chia sẻ link để chia sẻ bộ lọc
- **Chuyển Bảng / Danh sách** trên `/applications` → bảng để lướt mắt, danh sách để sắp xếp theo ngày
- **Ngôn ngữ** trong Cài đặt → English / Tiếng Việt / Bahasa Indonesia. Nội dung công việc giữ nguyên ngôn ngữ gốc; chỉ giao diện được dịch.

---

## Cái foray sẽ KHÔNG làm

Giới hạn thẳng thắn, đặt từ đầu:

- **Sẽ không ứng tuyển thay bạn.** Thêm foray một cú nhấp; phần ứng tuyển là việc của bạn.
- **Sẽ không thúc đẩy bạn.** Không streak, không vòng dopamine, không câu kiểu "bạn làm được mà". Sản phẩm cho bạn dữ liệu; động lực là của bạn.
- **Sẽ không theo dõi công ty bạn không ứng tuyển.** Mỗi foray là một foray bạn bắt đầu.
- **Sẽ không lưu trọn nội dung email mãi mãi.** Chỉ lưu trích đoạn, nội dung đầy đủ tải khi cần. Riêng tư là số một.
- **Sẽ không giả vờ bộ phân loại luôn đúng.** Bất cứ gì dưới 85% tin cậy đều ngồi trong hàng chờ xem lại với phần trăm hiển thị — bạn thấy mô hình nghĩ gì rồi quyết.

Vậy đó. Mở [trang Hôm nay](/today) và nhìn thử.
