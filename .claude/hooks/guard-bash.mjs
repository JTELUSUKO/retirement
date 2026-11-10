// PreToolUse hook for Bash: blocks two commands that have wasted past sessions (docs/agent-retrospectives.md).
// It reads the command the way the shell would, so the same words inside a commit message, a grep pattern or a
// heredoc are left alone.

const WRAPPERS = new Set([
  'npx', 'bunx', 'npm', 'pnpm', 'yarn', 'exec', 'x', 'dlx', 'sudo', 'env', 'command', 'time',
  'if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{',
])

// Index of the ")" that closes the "(" at `open`, skipping quoted text
function closingParen(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') i++
    else if (c === "'") i = src.indexOf("'", i + 1) < 0 ? src.length : src.indexOf("'", i + 1)
    else if (c === '(') depth++
    else if (c === ')' && --depth === 0) return i
  }
  return src.length
}

// Every simple command in `src` as a list of unquoted words, including commands inside $(...) and backticks
function commands(src) {
  // Heredoc bodies are data, not commands
  src = src.replace(/(?<!<)<<(?!<)-?\s*\\?(['"]?)([A-Za-z_]\w*)\1([^\n]*\n)[^]*?^\t*\2[ \t]*$/gm, ' $3')
  const found = []
  let words = []
  let word = null
  const endWord = () => {
    if (word !== null) words.push(word)
    word = null
  }
  const endCommand = () => {
    endWord()
    if (words.length) found.push(words)
    words = []
  }
  // Copies a $(...) or `...` starting at i into the current word, queues its contents, returns its last index
  const substitution = (i) => {
    const end = src[i] === '`' ? src.indexOf('`', i + 1) : closingParen(src, i + 1)
    const last = end < 0 ? src.length : end
    found.push(...commands(src.slice(i + (src[i] === '`' ? 1 : 2), last)))
    word = (word ?? '') + src.slice(i, last + 1)
    return last
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') {
      if (src[++i] !== '\n') word = (word ?? '') + (src[i] ?? '')
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1)
      word = (word ?? '') + src.slice(i + 1, end < 0 ? src.length : end)
      i = end < 0 ? src.length : end
    } else if (c === '"') {
      word ??= ''
      for (i++; i < src.length && src[i] !== '"'; i++) {
        if (src[i] === '\\') word += src[++i] ?? ''
        else if (src[i] === '`' || (src[i] === '$' && src[i + 1] === '(')) i = substitution(i)
        else word += src[i]
      }
    } else if (c === '`' || (c === '$' && src[i + 1] === '(')) {
      i = substitution(i)
    } else if (c === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i++
      endCommand()
    } else if (';&|()\n'.includes(c)) {
      endCommand()
    } else if (c === ' ' || c === '\t') {
      endWord()
    } else {
      word = (word ?? '') + c
    }
  }
  endCommand()
  return found
}

function reasonToDeny(words) {
  let start = 0
  while (
    start < words.length &&
    (WRAPPERS.has(words[start]) || words[start].startsWith('-') || /^[A-Za-z_]\w*=/.test(words[start]))
  ) {
    start++
  }
  const [name, ...args] = words.slice(start)

  // Playwright run by hand tests whatever was built last
  if (name?.split('/').pop() === 'playwright' && args[0] === 'test') {
    return 'Use npm run e2e (it builds with BASE_PATH=/ first) or npm run e2e:live. Pass Playwright options after --, e.g. npm run e2e -- --grep heatmap.'
  }

  // gh run list --commit returns nothing for a short hash
  const run = args.indexOf('run')
  if (name === 'gh' && run >= 0 && args[run + 1] === 'list') {
    const flag = args.findIndex((arg) => arg === '--commit' || arg === '-c' || arg.startsWith('--commit='))
    const value = flag < 0 ? '' : args[flag].startsWith('--commit=') ? args[flag].slice(9) : (args[flag + 1] ?? '')
    if (/^[0-9a-f]{4,39}$/i.test(value) || /rev-parse\s[^)]*--short/.test(value)) {
      return 'gh run list --commit needs the full 40-character hash; use $(git rev-parse HEAD).'
    }
  }
  return null
}

let input = ''
for await (const chunk of process.stdin) input += chunk
const command = JSON.parse(input).tool_input?.command ?? ''
const reason = commands(command).map(reasonToDeny).find(Boolean)
if (reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  )
}
