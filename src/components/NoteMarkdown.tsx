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
    // Rasm va jadval telefonda butun sahifani gorizontal surmasin; preflight olib tashlagan
    // sarlavha/ro'yxat ko'rinishi qaytariladi.
    <div className="max-w-full space-y-3 break-words [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6">
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
