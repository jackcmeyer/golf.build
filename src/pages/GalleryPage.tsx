import { useNavigate } from '@tanstack/react-router'
import { Gallery } from '../components/Gallery'

export function GalleryPage() {
  const navigate = useNavigate()
  return (
    <Gallery
      onView={(courseId) => navigate({ to: '/view/$courseId', params: { courseId } })}
      onClose={() => navigate({ to: '/editor' })}
    />
  )
}
