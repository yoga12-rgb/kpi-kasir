-- Private avatar bucket limits are enforced by Storage as a second layer.

update storage.buckets
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'cashier-photos';
