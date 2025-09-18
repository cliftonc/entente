import CodeBlock from '../CodeBlock'

function DeploymentsExample() {
  const deploymentCode = `entente deploy-service -s my-service -v 1.0.0 -e production -t provider
entente deploy-service -s my-consumer -v 2.0.3 -e production -t consumer`
  const canIDeployCode = `entente can-i-deploy -s my-consumer -e production -t consumer`

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Check Before Deploying</h4>
        <CodeBlock code={canIDeployCode} language="bash" showLineNumbers={false} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">Record Deployment</h4>
        <CodeBlock code={deploymentCode} language="bash" showLineNumbers={false} />
      </div>
    </div>
  )
}

export default DeploymentsExample
