import { useParams } from '@tanstack/react-router'
import VoxelCanvas from '../components/VoxelCanvas'

export function ViewerPage() {
  const { courseId } = useParams({ from: '/view/$courseId' })
  return <VoxelCanvas courseId={courseId} readOnly />
}
