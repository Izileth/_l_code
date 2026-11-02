import type { Token, TokenKind } from './types'

const KEYWORDS = new Set([
  // Python
  'import', 'from', 'class', 'def', 'return', 'yield', 'if', 'else', 'elif', 'for', 'in',
  'while', 'await', 'async', 'as', 'with', 'lambda', 'pass', 'True', 'False', 'None',
  'and', 'or', 'not', 'self',
  // JavaScript
  'const', 'let', 'var', 'function', 'new', 'this', 'constructor', 'export', 'default',
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'void', 'delete', 'throw',
  'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue', 'super', 'extends',
  'of',
])

const SOURCE =
  /(\s+)|((?:#|\/\/).*$)|(f?"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|([\s\S])/g

/** Mini tokenizer de Python e JavaScript só para colorir as linhas estáticas do código gerado. */
export function tokenize(src: string): Token[] {
  const re = new RegExp(SOURCE.source, 'g')
  const out: Token[] = []
  let prev = ''
  let m: RegExpExecArray | null

  while ((m = re.exec(src)) !== null) {
    if (m[1]) {
      out.push({ t: m[1], k: 'plain' })
      continue
    }
    let k: TokenKind = 'plain'
    if (m[2]) k = 'com'
    else if (m[3]) k = 'str'
    else if (m[4]) k = 'num'
    else if (m[5]) {
      const id = m[5]
      const call = src.slice(re.lastIndex).trimStart().startsWith('(')
      if (KEYWORDS.has(id)) k = 'kw'
      else if (prev === 'class' || prev === 'new' || prev === 'extends') k = 'cls'
      else if (prev === 'def' || prev === 'function') k = 'fn'
      else if (prev === 'import' || prev === 'from') k = 'fn'
      else if (prev === '.') k = call ? 'fn' : 'attr'
      else if (call) k = /^[A-Z]/.test(id) ? 'cls' : 'fn'
    }
    out.push({ t: m[0], k })
    prev = m[5] || m[0]
  }
  return out
}
