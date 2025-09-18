import CodeBlock from '../CodeBlock'

function ServicesExample() {
  const bashCode = `npm install -g @entente/cli
entente login
entente register-service -s my-service -t provider --spec specs/openapi.json
entente register-service -s my-consumer -t consumer`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Install CLI & Register Service
        </h4>
        <CodeBlock code={bashCode} language="bash" />
      </div>
    </div>
  )
}

export default ServicesExample
