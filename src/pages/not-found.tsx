import { Link } from "react-router-dom"
import { FileQuestion } from "lucide-react"
import { EmptyState, Panel } from "@/components/common"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <Panel>
      <EmptyState
        icon={FileQuestion}
        title="This page doesn’t exist"
        action={
          <Button asChild>
            <Link to="/">Go to the overview</Link>
          </Button>
        }
      >
        The link may be old, or the record may belong to another workspace.
      </EmptyState>
    </Panel>
  )
}
