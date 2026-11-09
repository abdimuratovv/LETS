import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function omitNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

// Xom HTML qo'llab-quvvatlanmaydi (rehype-raw yo'q); xavfli URL'lar react-markdown tomonidan tozalanadi.
export function NoteMarkdown({ source }: { source: string }) {
  return (
    <div className="max-w-full break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...omitNode(props)} target="_blank" rel="noopener noreferrer" className="underline" />
          ),
          pre: (props) => (
            <pre {...omitNode(props)} className="max-w-full overflow-x-auto rounded bg-black/5 p-3" />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
