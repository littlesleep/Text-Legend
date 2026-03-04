const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function supportsColor() {
  if (String(process.env.LOG_COLOR || '').toLowerCase() === 'false') return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return Boolean(process.stdout?.isTTY);
}

function toText(args) {
  return args.map((part) => (typeof part === 'string' ? part : String(part))).join(' ');
}

function tint(text, color) {
  if (!color) return text;
  return `${color}${text}${ANSI.reset}`;
}

function colorizeLine(text, method = 'log') {
  const line = String(text || '');
  if (!line) return line;
  if (line.includes('\x1b[')) return line;

  if (line.startsWith('[db][slow][error]')) return tint(line, ANSI.red);
  if (line.startsWith('[db][slow]')) return tint(line, ANSI.yellow);
  if (line.startsWith('[health]')) return tint(line, ANSI.cyan);
  if (line.startsWith('[guard]')) return tint(line, ANSI.magenta);
  if (line.startsWith('[mob_respawns]')) return tint(line, ANSI.green);
  if (line.startsWith('[shutdown]')) return tint(line, ANSI.gray);

  if (method === 'error') return tint(line, ANSI.red);
  if (method === 'warn') return tint(line, ANSI.yellow);
  return line;
}

let patched = false;

export function setupConsoleColors() {
  if (patched) return;
  patched = true;
  if (!supportsColor()) return;

  const rawLog = console.log.bind(console);
  const rawInfo = console.info.bind(console);
  const rawWarn = console.warn.bind(console);
  const rawError = console.error.bind(console);

  console.log = (...args) => rawLog(colorizeLine(toText(args), 'log'));
  console.info = (...args) => rawInfo(colorizeLine(toText(args), 'info'));
  console.warn = (...args) => rawWarn(colorizeLine(toText(args), 'warn'));
  console.error = (...args) => rawError(colorizeLine(toText(args), 'error'));
}
