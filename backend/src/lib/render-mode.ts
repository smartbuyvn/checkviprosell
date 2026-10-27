/**
 * Viprosell — chuan hoa gia tri render_mode truoc khi ghi xuong DB.
 *
 * Enum render_mode cua Postgres chi nhan: draft_local | draft_local_tts | premium_cloud
 * (xem supabase/migrations — nguon su that). Frontend lai dung dang viet lien
 * ('draftlocaltts', 'premiumcloud') va chuyen doi bang src/lib/enumMapper.ts, nhung
 * duong render di qua backend nen khong qua mapper do: gia tri tho bi insert thang
 * vao DB va Postgres tu choi ca cau lenh.
 *
 * De o lib/ vi day la logic thuan, khong phu thuoc env hay ket noi nao.
 */

const RENDER_MODE_TO_DB: Record<string, string> = {
  draft_local: 'draft_local',
  draftlocal: 'draft_local',
  draft_local_tts: 'draft_local_tts',
  draftlocaltts: 'draft_local_tts',
  premium_cloud: 'premium_cloud',
  premiumcloud: 'premium_cloud',
};

/** Doi gia tri render mode bat ky ve dung enum cua DB; nem loi neu khong hop le. */
export function toDbRenderMode(value: string): string {
  const mapped = RENDER_MODE_TO_DB[String(value ?? '').trim().toLowerCase()];
  if (!mapped) {
    throw new Error(
      `INVALID_RENDER_MODE: "${value}" khong thuoc draft_local | draft_local_tts | premium_cloud`
    );
  }
  return mapped;
}
