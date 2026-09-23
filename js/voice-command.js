// Comando de voz para marcar "Limpo" ou "Errei" sem largar a guitarra.
//
// Usa o reconhecimento de fala do navegador (Web Speech API). Duas limitações reais, que não têm
// como contornar no código: 1) precisa de internet — o reconhecimento roda na nuvem do Google,
// não no aparelho; 2) o microfone capta o som do amplificador junto com a voz, então pode
// atrapalhar num volume alto.
//
// parseCommand() é pura e testável sem navegador (ver tests/voice-command.test.mjs). O resto
// (VoiceCommand) depende da API do navegador e só é exercitado manualmente.

const CLEAN_WORDS = new Set(['limpo', 'limpou', 'limpa', 'limpei']);
const ERROR_WORDS = new Set(['errei', 'errou', 'errado', 'errada', 'erro']);

// Tira acento e pontuação para comparar palavra por palavra ("Limpo!" → "limpo").
function words(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// Devolve 'ok' | 'bad' | null a partir de um trecho reconhecido (pode vir com várias palavras).
// Se a frase tiver as duas palavras (fala apressada, reconhecimento confuso), fica em dúvida e
// não marca nada — melhor perder uma marcação do que marcar a errada.
export function parseCommand(text) {
  const list = words(text);
  const hasClean = list.some((w) => CLEAN_WORDS.has(w));
  const hasError = list.some((w) => ERROR_WORDS.has(w));
  if (hasClean && !hasError) return 'ok';
  if (hasError && !hasClean) return 'bad';
  return null;
}

function getRecognitionClass() {
  return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

export const voiceSupported = Boolean(getRecognitionClass());

const DEBOUNCE_MS = 1200; // uma fala não pode contar duas vezes (resultado parcial + final)

class VoiceCommand {
  constructor() {
    this.recognition = null;
    this.activeKey = null;
    this.state = 'idle'; // idle | listening | denied | unsupported | error
    this.onCommand = null;
    this.lastFireAt = 0;
    this.lastHeard = ''; // o que o telefone entendeu por último — ajuda a calibrar a lista de palavras
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  isActive(key) { return this.activeKey === key; }

  toggle(key, onCommand) { (this.isActive(key) ? this.stop : this.start).call(this, key, onCommand); }

  // key identifica o exercício (só um comando de voz ativo por vez, como o metrônomo).
  start(key, onCommand) {
    const Recognition = getRecognitionClass();
    this.stop();
    if (!Recognition) { this.state = 'unsupported'; this.emit(); return; }

    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue; // só guarda/decide em cima do texto já fechado, não do rascunho
        const transcript = result[0].transcript.trim();
        if (transcript) { this.lastHeard = transcript; this.emit(); }
        const cmd = parseCommand(transcript);
        if (!cmd) continue;
        const now = Date.now();
        if (now - this.lastFireAt < DEBOUNCE_MS) continue;
        this.lastFireAt = now;
        this.onCommand?.(cmd);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.activeKey = null;
        this.state = 'denied';
        this.emit();
      }
      // outros erros ('no-speech', 'network', 'aborted') não desligam: o onend reinicia sozinho.
    };
    recognition.onend = () => {
      if (this.activeKey === key) { try { recognition.start(); } catch (e) { /* já reiniciando */ } }
    };

    this.recognition = recognition;
    this.activeKey = key;
    this.onCommand = onCommand;
    try {
      recognition.start();
      this.state = 'listening';
    } catch (e) {
      this.activeKey = null;
      this.state = 'error';
    }
    this.emit();
  }

  stop() {
    const was = this.activeKey;
    this.activeKey = null;
    this.onCommand = null;
    if (this.recognition) { try { this.recognition.stop(); } catch (e) { /* ignora */ } }
    this.recognition = null;
    if (was) { this.state = 'idle'; this.emit(); }
  }
}

export const voiceCommand = new VoiceCommand();
