-- MVP-06: the explainer bucket also takes the few JPEG frames the phone samples from a video for
-- review (08 §7b). Guarded for local PGlite tests without Storage.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
      set allowed_mime_types = array['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4', 'audio/ogg', 'image/jpeg']
      where id = 'explainers';
  end if;
end $$;
