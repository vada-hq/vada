import { DuesRosterUploadModal } from './dues-roster-upload/DuesRosterUploadModal'
import { useDuesRosterUpload } from './dues-roster-upload/useDuesRosterUpload'

interface ORG07CScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07CScreen({ onNavigate }: ORG07CScreenProps) {
  const model = useDuesRosterUpload(onNavigate)
  return <DuesRosterUploadModal model={model} />
}
