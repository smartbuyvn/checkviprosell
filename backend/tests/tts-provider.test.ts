import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheKey, looksLikeMp3, looksLikeWav, looksLikeAudio, ttsEnabled, TtsError } from '../src/services/tts.provider';

/**
 * Lop long tieng. Chan may loi de xay ra ma kho thay:
 * - cache danh nham khoa -> khach doi giong moi van nghe giong cu
 * - nhan mot trang loi la mp3 -> video mat tieng, khong bao gi
 * - bat nham cong tac -> goi API that trong khi tuong la dang tat
 */

test('cung cau cung giong thi ra cung khoa — nho vay moi cache duoc', () => {
  const a = cacheKey('Giam 50% hom nay', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Giam 50% hom nay', 'banmai', 'fpt', 'v1');
  assert.equal(a, b);
});

test('khoang trang thua khong tao khoa moi', () => {
  const a = cacheKey('  Giam 50%  ', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Giam 50%', 'banmai', 'fpt', 'v1');
  assert.equal(a, b, 'khong thi sua mot dau cach cung ton tien goi lai');
});

test('doi giong thi phai ra khoa khac', () => {
  const a = cacheKey('Xin chao', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Xin chao', 'leminh', 'fpt', 'v1');
  assert.notEqual(a, b, 'cung khoa thi khach doi giong van nghe giong cu');
});

test('doi nha cung cap thi phai ra khoa khac', () => {
  const a = cacheKey('Xin chao', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Xin chao', 'banmai', 'vieneu', 'v1');
  assert.notEqual(a, b, 'chuyen FPT sang VieNeu ma dung lai file cu la sai');
});

test('doi phien ban cache thi phai ra khoa khac', () => {
  const a = cacheKey('Xin chao', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Xin chao', 'banmai', 'fpt', 'v2');
  assert.notEqual(a, b, 'khong doi duoc thi khong co cach nao buoc sinh lai');
});

test('hai cau khac nhau khong duoc dung mot khoa', () => {
  const a = cacheKey('Giam 50%', 'banmai', 'fpt', 'v1');
  const b = cacheKey('Giam 40%', 'banmai', 'fpt', 'v1');
  assert.notEqual(a, b);
});

test('ghep truong khong gay dung khoa — "ab"+"c" phai khac "a"+"bc"', () => {
  // Noi chuoi bang dau phan cach thuong se cho hai bo khac nhau cung mot khoa.
  const a = cacheKey('x', 'ab', 'c', 'v1');
  const b = cacheKey('x', 'a', 'bc', 'v1');
  assert.notEqual(a, b, 'khoa bi dung — mot cau co the lay nham file cua cau khac');
});

test('nhan dung MP3 co the ID3', () => {
  const buf = Buffer.concat([Buffer.from('ID3', 'ascii'), Buffer.alloc(20)]);
  assert.equal(looksLikeMp3(buf), true);
});

test('nhan dung MP3 frame sync', () => {
  assert.equal(looksLikeMp3(Buffer.from([0xff, 0xfb, 0x90, 0x00])), true);
});

test('TU CHOI trang HTML gia danh mp3', () => {
  const html = Buffer.from('<!doctype html><html>loi</html>', 'utf8');
  assert.equal(looksLikeMp3(html), false, 'nhan nham thi video mat tieng ma khong bao gi');
});

test('TU CHOI JSON loi', () => {
  assert.equal(looksLikeMp3(Buffer.from('{"error":1}', 'utf8')), false);
});

test('TU CHOI file rong', () => {
  assert.equal(looksLikeMp3(Buffer.alloc(0)), false);
});

test('nhan dung WAV — VieNeu cuc bo thuong tra WAV', () => {
  const wav = Buffer.concat([
    Buffer.from('RIFF', 'ascii'), Buffer.alloc(4),
    Buffer.from('WAVE', 'ascii'), Buffer.alloc(20),
  ]);
  assert.equal(looksLikeWav(wav), true);
  assert.equal(looksLikeAudio(wav), true, 'WAV phai duoc chap nhan, ffmpeg doc duoc');
});

test('looksLikeAudio chap nhan ca MP3 lan WAV, tu choi rac', () => {
  assert.equal(looksLikeAudio(Buffer.from([0xff, 0xfb, 0x90, 0x00])), true);
  assert.equal(looksLikeAudio(Buffer.from('<!doctype html>', 'utf8')), false);
  assert.equal(looksLikeAudio(Buffer.from('{"error":"model not loaded"}', 'utf8')), false);
});

test('cong tac long tieng: mac dinh TAT, VieNeu khong doi khoa API', () => {
  const saved: Record<string, string | undefined> = {};
  for (const k of ['TTS_ENABLED', 'TTS_PROVIDER', 'FPT_TTS_API_KEY']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }

  // Mac dinh tat: bat san khi chua dung server TTS thi moi video deu mat mot lan
  // goi that bai, cham va day log day loi.
  assert.equal(ttsEnabled(), false, 'mac dinh phai tat');

  process.env.TTS_ENABLED = 'true';
  // VieNeu chay cuc bo nen khong can khoa — bat co la du.
  assert.equal(ttsEnabled(), true, 'VieNeu khong doi khoa API');

  process.env.TTS_PROVIDER = 'fpt';
  assert.equal(ttsEnabled(), false, 'FPT thieu khoa thi phai coi la tat');

  process.env.FPT_TTS_API_KEY = 'test-key';
  assert.equal(ttsEnabled(), true, 'FPT du khoa thi bat');

  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!;
  }
});

test('TtsError mang theo ma loi de ben goi phan biet duoc', () => {
  const e = new TtsError('het gio', 'TTS_TIMEOUT');
  assert.equal(e.code, 'TTS_TIMEOUT');
  assert.equal(e.name, 'TtsError');
  assert.ok(e instanceof Error);
});
