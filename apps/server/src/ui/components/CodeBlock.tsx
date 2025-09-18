import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  code: string
  language: 'bash' | 'typescript' | 'javascript' | 'json' | 'prisma'
  showLineNumbers?: boolean
}

function CodeBlock({ code, language, showLineNumbers = true }: CodeBlockProps) {
  return (
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      showLineNumbers={showLineNumbers}
      customStyle={{
        margin: 0,
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        backgroundColor: '#1e1e1e',
        textShadow: 'none',
        maxHeight: '400px',
        overflowY: 'auto',
      }}
      codeTagProps={{
        style: {
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          textShadow: 'none',
        },
      }}
      lineNumberStyle={{
        textShadow: 'none',
      }}
    >
      {code}
    </SyntaxHighlighter>
  )
}

export default CodeBlock
