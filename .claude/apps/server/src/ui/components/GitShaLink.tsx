import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

interface GitShaLinkProps {
  sha?: string | null
  repositoryUrl?: string | null
  showFullSha?: boolean
  className?: string
}

export default function GitShaLink({
  sha,
  repositoryUrl,
  showFullSha = false,
  className = '',
}: GitShaLinkProps) {
  if (!sha) {
    return <span className="text-base-content/50 text-sm">-</span>
  }

  const shortSha = showFullSha ? sha : sha.substring(0, 7)

  if (!repositoryUrl) {
    return (
      <span className={`font-mono text-sm ${className}`} title={sha}>
        {shortSha}
      </span>
    )
  }

  // Build GitHub commit URL
  const commitUrl = `${repositoryUrl}/commit/${sha}`

  return (
    <a
      href={commitUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-mono text-sm hover:underline text-primary inline-flex items-center gap-1 ${className}`}
      title={`${sha} - Click to view commit on GitHub`}
    >
      {shortSha}
      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
    </a>
  )
}
