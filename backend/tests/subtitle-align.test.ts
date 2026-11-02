import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkText, splitByChars, parseSrt, srtTimeToSec, mapTextToTiming,
} from '../src/lib/subtitle-align';

/**
 * Can phu de khop giong doc.
 *
 * Truoc day phu de bam theo moc CANH: canh 4 giay thi chu hien suot 4 giay du
 * nguoi doc chi noi 2,3 giay. Chu chay truoc hoac dong lai sau tieng noi — day
 * la thu phan biet video quang cao that voi slideshow co chu.
 */

test('khong cat giua tu', () => {
  const cues = chunkText('Kem chong nang nang tong kiem dau suot muoi hai tieng', 20);
  for (const c of cues) {
    assert.ok(!c.startsWith(' ') && !c.endsWith(' '), 'mau khong duoc co khoang trang thua');
  }
  // Ghep lai phai ra dung cau goc: khong mat chu, khong them chu.
  assert.equal(cues.join(' '), 'Kem chong nang nang tong kiem dau suot muoi hai tieng');
});

test('tu dai hon gioi han van duoc giu nguyen, khong bam doi', () => {
  const cues = chunkText('Sieucalifragilisticexpialidocious', 10);
  assert.equal(cues.length, 1);
  assert.equal(cues[0], 'Sieucalifragilisticexpialidocious');
});

test('cau rong tra ve mang rong, khong nem loi', () => {
  assert.deepEqual(chunkText('   '), []);
  assert.deepEqual(splitByChars('', 5), []);
});

test('tong thoi gian cac mau dung bang do dai giong doc', () => {
  const cues = splitByChars('Giam nam muoi phan tram hom nay, son li hai muoi bon gio', 6, 20);
  assert.ok(cues.length > 1, 'cau nay phai chia thanh nhieu mau');
  assert.equal(cues[0].startSec, 0);
  // Mau cuoi phai ket thuc DUNG tai 6s. Sai so cong don se lam chu bien mat
  // truoc khi tieng noi dut.
  assert.equal(cues[cues.length - 1].endSec, 6);
});

test('cac mau noi lien nhau, khong ho khong chong', () => {
  const cues = splitByChars('Mot hai ba bon nam sau bay tam chin muoi mot hai ba', 10, 15);
  for (let i = 1; i < cues.length; i++) {
    assert.equal(cues[i].startSec, cues[i - 1].endSec,
      'mau ' + i + ' phai bat dau dung luc mau truoc ket thuc');
  }
});

test('mau dai hon duoc nhieu thoi gian hon — chia theo ky tu, khong chia deu', () => {
  const cues = splitByChars('A rat rat rat rat rat rat rat rat dai', 10, 12);
  assert.ok(cues.length >= 2);

  // Kiem dung tinh chat can co: mau NHIEU ky tu hon phai duoc thoi gian khong it hon.
  // Khong dung indexOf(max) vi hai mau bang nhau ve so ky tu co the lech nhau mot
  // phan tram giay do lam tron, luc do indexOf chi ra hai vi tri khac nhau.
  const items = cues.map((c) => ({ len: c.text.length, dur: c.endSec - c.startSec }));
  for (const a of items) {
    for (const b of items) {
      if (a.len > b.len) {
        assert.ok(
          a.dur >= b.dur - 0.02,
          `mau ${a.len} ky tu duoc ${a.dur.toFixed(2)}s, it hon mau ${b.len} ky tu duoc ${b.dur.toFixed(2)}s`
        );
      }
    }
  }

  // Va chia deu thi moi mau bang nhau — phai khac nhau that su.
  const durs = items.map((i) => i.dur);
  assert.ok(Math.max(...durs) - Math.min(...durs) > 0.5, 'chia deu thi cau ngan bi giu qua lau tren man hinh');
});

test('doc duoc moc thoi gian SRT', () => {
  assert.equal(srtTimeToSec('00:00:03,480'), 3.48);
  assert.equal(srtTimeToSec('00:01:00,000'), 60);
  assert.equal(srtTimeToSec('01:00:00,000'), 3600);
  assert.equal(srtTimeToSec('khong phai thoi gian'), null);
});

test('doc duoc SRT cua Whisper', () => {
  const srt = [
    '1',
    '00:00:00,000 --> 00:00:02,100',
    'Giam nam muoi phan tram',
    '',
    '2',
    '00:00:02,100 --> 00:00:04,500',
    'chi hom nay thoi nhe',
  ].join('\n');

  const cues = parseSrt(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startSec, 0);
  assert.equal(cues[0].endSec, 2.1);
  assert.equal(cues[1].text, 'chi hom nay thoi nhe');
});

test('SRT co mau hong thi bo mau do, khong vut ca file', () => {
  const srt = [
    '1',
    '00:00:00,000 --> 00:00:02,000',
    'Mau tot',
    '',
    '2',
    'thieu dong thoi gian',
    '',
    '3',
    '00:00:03,000 --> 00:00:05,000',
    'Mau tot thu hai',
  ].join('\n');

  const cues = parseSrt(srt);
  assert.equal(cues.length, 2, 'mat mot mau van hon mat toan bo phu de');
  assert.equal(cues[1].text, 'Mau tot thu hai');
});

test('SRT co moc ket thuc truoc moc bat dau thi bi loai', () => {
  const srt = '1\n00:00:05,000 --> 00:00:02,000\nNguoc thoi gian';
  assert.deepEqual(parseSrt(srt), []);
});

/**
 * Dat chu GOC len moc thoi gian Whisper.
 *
 * Model small nghe tieng Viet van sai nhieu: do that cho ra "Kem chong nang"
 * thanh "Kem trong nang", "khong gay bi da" thanh "Hom nay bi ra". Hien chu sai
 * tren video quang cao con te hon phu de lech vai phan muoi giay.
 */

test('giu chu GOC, khong dung chu Whisper nghe nham', () => {
  const nghe = [
    { startSec: 0, endSec: 2, text: 'Kem trong nang nang tong' },
    { startSec: 2, endSec: 4, text: 'Hom nay bi ra' },
  ];
  const goc = 'Kem chong nang nang tong, khong gay bi da';

  const cues = mapTextToTiming(goc, nghe);
  const ghep = cues.map((c) => c.text).join(' ');

  assert.equal(ghep, goc, 'chu phai la ban goc tung chu mot');
  assert.ok(!ghep.includes('trong nang'), 'khong duoc lan chu Whisper nghe nham vao');
});

test('moc thoi gian lay tu Whisper, khong tu bia', () => {
  const nghe = [
    { startSec: 0.5, endSec: 2.3, text: 'abc' },
    { startSec: 2.3, endSec: 4.1, text: 'def' },
  ];
  const cues = mapTextToTiming('mot hai ba bon nam sau', nghe);
  assert.equal(cues[0].startSec, 0.5);
  assert.equal(cues[cues.length - 1].endSec, 4.1);
});

test('khong mat tu nao du lam tron lech', () => {
  const nghe = [
    { startSec: 0, endSec: 1, text: 'x' },
    { startSec: 1, endSec: 2, text: 'y' },
    { startSec: 2, endSec: 3, text: 'z' },
  ];
  const goc = 'mot hai ba bon nam sau bay';  // 7 tu chia 3 khoang
  const cues = mapTextToTiming(goc, nghe);
  assert.equal(cues.map((c) => c.text).join(' '), goc, 'lam tron khong duoc lam roi tu');
});

test('khoang dai hon nhan nhieu tu hon', () => {
  const nghe = [
    { startSec: 0, endSec: 3, text: 'dai' },   // 3 giay
    { startSec: 3, endSec: 4, text: 'ngan' },  // 1 giay
  ];
  const cues = mapTextToTiming('mot hai ba bon nam sau bay tam', nghe);
  const soTu = cues.map((c) => c.text.split(' ').length);
  assert.ok(soTu[0] > soTu[1], 'khoang 3 giay phai nhan nhieu tu hon khoang 1 giay');
});

test('moc hong (ket thuc truoc bat dau) bi loai', () => {
  const nghe = [
    { startSec: 5, endSec: 2, text: 'nguoc' },
    { startSec: 2, endSec: 4, text: 'dung' },
  ];
  const cues = mapTextToTiming('mot hai ba', nghe);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].startSec, 2);
});

test('khong co moc nao thi tra mang rong, khong nem loi', () => {
  assert.deepEqual(mapTextToTiming('co chu', []), []);
  assert.deepEqual(mapTextToTiming('', [{ startSec: 0, endSec: 1, text: 'x' }]), []);
});
