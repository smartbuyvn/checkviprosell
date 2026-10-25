/** Escape text for an FFmpeg drawtext filter; % stays literal because callers set expansion=none. */
export function escapeDrawText(text: string): string {
  // Không cắt 60 ký tự nữa: câu bán hàng bị cụt giữa chừng. Độ dài do caller quyết định.
  return text.replace(/\\/g, '/').replace(/'/g, '').replace(/:/g, '\\:');
}

/** Build one drawtext filter clause, centred horizontally at the given y. */
export function buildDrawtext(
  text: string,
  fontSize: number,
  y: string,
  color: string = 'white',
  fontFile: string = ''
): string {
  const safeText = escapeDrawText(text);
  const fontPart = fontFile ? `fontfile='${fontFile.replace(/\\/g, '/').replace(/:/g, '\\:')}':` : '';
  // expansion=none: thiếu nó thì FFmpeg đọc '%' là mã định dạng và BỎ CẢ DÒNG CHỮ mà vẫn báo
  // thành công — "Giảm 50% hôm nay" biến mất khỏi video. Phụ đề ASS sẽ thay hàm này ở S3-2.
  return `drawtext=${fontPart}expansion=none:text='${safeText}':fontsize=${fontSize}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:shadowx=2:shadowy=2:shadowcolor=black`;
}
