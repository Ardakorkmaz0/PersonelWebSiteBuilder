import { useMemo, useState } from 'react'
import { useEditorStore } from '../../store/editorStore.js'
import { schemaToFiles } from '../../utils/schemaToFiles.js'

// Read-only live code view. Regenerates the project's HTML/CSS from the current
// schema on every edit. Drag/resize an element and the markup updates here. The
// user never types code (XSS-safe by construction). Builder UI styling.
const ICON = { html: 'HTML', css: 'CSS', json: '{ }' }

export default function CodePanel() {
  const schema = useEditorStore((s) => s.schema)
  const files = useMemo(() => schemaToFiles(schema), [schema])
  const [active, setActive] = useState('index.html')
  const [copied, setCopied] = useState(false)

  const file = files.find((f) => f.name === active) || files[0]
  const htmlFiles = files.filter((f) => f.lang === 'html')
  const others = files.filter((f) => f.lang !== 'html')

  const FileBtn = ({ f, indent }) => (
    <button
      type="button"
      onClick={() => setActive(f.name)}
      style={{ paddingLeft: indent }}
      className={`flex w-full items-center gap-1.5 rounded-[2px] py-1 pr-1.5 text-left text-xs ${
        file?.name === f.name
          ? 'bg-[#eff3fb] text-[#2b579a]'
          : 'text-[#323130] hover:bg-[#f3f2f1]'
      }`}
    >
      <span className="w-8 text-[10px] font-semibold text-[#605e5c]">
        {ICON[f.lang] || 'FILE'}
      </span>
      <span className="truncate">{f.name}</span>
    </button>
  )

  function copy() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(file.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e1dfdd] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
          Code files
        </span>
        <span className="ml-auto rounded-[2px] bg-[#dff6dd] px-1.5 py-0.5 text-[10px] font-semibold text-[#0b6a0b]">
          live generated
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* File tree */}
        <div className="w-36 shrink-0 overflow-y-auto border-r border-[#e1dfdd] bg-[#faf9f8] p-1.5">
          <div className="flex items-center gap-1 px-1 py-1 text-xs font-semibold text-[#323130]">
            <span className="font-mono text-[10px]">/</span>
            <span>my-site</span>
          </div>
          <div className="flex items-center gap-1 py-1 pl-3 text-xs font-medium text-[#605e5c]">
            <span className="font-mono text-[10px]">/</span>
            <span>pages</span>
          </div>
          {htmlFiles.map((f) => (
            <FileBtn key={f.name} f={f} indent={28} />
          ))}
          {others.map((f) => (
            <FileBtn key={f.name} f={f} indent={12} />
          ))}
        </div>

        {/* Code view */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-[#e1dfdd] px-3 py-1.5">
            <span className="font-mono text-xs text-[#605e5c]">{file?.name}</span>
            <button
              type="button"
              onClick={copy}
              className="rounded-[2px] border border-[#8a8886] px-2 py-0.5 text-xs font-medium text-[#323130] hover:bg-[#f3f2f1]"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e] p-3 font-mono text-[11px] leading-relaxed text-gray-100">
            <code>{file?.content}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
