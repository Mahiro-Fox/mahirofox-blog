import { getVideosAction } from '@/actions/app/videos';
import { VideosWall } from './videos-wall';

export default async function VideosPage() {
  const initial = await getVideosAction(1, 24);

  return (
    <VideosWall
      initialVideos={initial.videos}
      initialHasMore={initial.pagination.hasMore}
    />
  );
}
