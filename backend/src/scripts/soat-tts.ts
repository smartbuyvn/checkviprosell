/** Xác định provider TTS/Whisper đang thật sự chạy. KHÔNG in bất kỳ khóa nào. */
import 'dotenv/config';
import fs from 'node:fs';
const co = (k: string) => (process.env[k] ? 'DA DAT' : 'chua dat');
const provider = process.env.TTS_PROVIDER ?? '(trong) -> mac dinh "vieneu"';
console.log(`TTS_PROVIDER      = ${provider}`);
console.log(`VIENEU_BASE_URL   = ${process.env.VIENEU_BASE_URL ?? '(trong) -> mac dinh http://localhost:8080'}`);
console.log(`VIENEU_MODEL      = ${process.env.VIENEU_MODEL ?? '(trong)'}`);
console.log(`VIENEU_API_KEY    = ${co('VIENEU_API_KEY')}`);
console.log(`FPT_TTS_ENDPOINT  = ${process.env.FPT_TTS_ENDPOINT ?? '(trong) -> mac dinh https://api.fpt.ai/hmi/tts/v5'}`);
console.log(`FPT_TTS_VOICE     = ${process.env.FPT_TTS_VOICE ?? '(trong) -> mac dinh banmai'}`);
console.log(`FPT_TTS_API_KEY   = ${co('FPT_TTS_API_KEY')}`);
const wm = process.env.WHISPER_MODEL_PATH ?? '';
console.log(`WHISPER_MODEL_PATH= ${wm || '(trong)'}  ton tai: ${wm ? fs.existsSync(wm) : false}`);
if (wm && fs.existsSync(wm)) console.log(`  kich thuoc: ${(fs.statSync(wm).size / 1048576).toFixed(0)} MB`);
console.log(`REPLICATE_API_TOKEN= ${co('REPLICATE_API_TOKEN')}`);
console.log(`OLLAMA_ENABLED    = ${process.env.OLLAMA_ENABLED ?? '(trong)'}`);
