import CodeBlock from "../CodeBlock";

function DeploymentsExample() {
  const deploymentCode = `entente deploy-service -s my-service --service-version 1.0.0 -e production
entente deploy-service -s my-consumer --service-version 2.0.3 -e production`;
  const canIDeployCode = `entente can-i-deploy -s my-consumer -e production`;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Check Before Deploying
        </h4>
        <CodeBlock
          code={canIDeployCode}
          language="bash"
          showLineNumbers={false}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-base-content mb-2">
          Record Deployment
        </h4>
        <CodeBlock
          code={deploymentCode}
          language="bash"
          showLineNumbers={false}
        />
      </div>
    </div>
  );
}

export default DeploymentsExample;
