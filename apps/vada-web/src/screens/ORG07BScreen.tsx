import { StudentRosterUploadModal } from './student-roster-upload/StudentRosterUploadModal'
import { useStudentRosterUpload } from './student-roster-upload/useStudentRosterUpload'

interface ORG07BScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG07BScreen({ onNavigate }: ORG07BScreenProps) {
  const model = useStudentRosterUpload(onNavigate)
  return <StudentRosterUploadModal model={model} />
}
