/**
 * メディアタイプ判定のユーティリティ関数
 */

export type MediaType = 'image' | 'video' | 'unknown';

/**
 * MIMEタイプからメディアタイプを判定
 */
export function getMediaTypeFromMime(mime: string): MediaType {
  if (mime.startsWith('image/')) {
    return 'image';
  }
  if (mime.startsWith('video/')) {
    return 'video';
  }
  return 'unknown';
}

/**
 * ファイル拡張子からメディアタイプを判定
 */
export function getMediaTypeFromExtension(filename: string): MediaType {
  const extension = filename.toLowerCase().split('.').pop();
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'];
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'];
  
  if (extension && imageExtensions.includes(extension)) {
    return 'image';
  }
  if (extension && videoExtensions.includes(extension)) {
    return 'video';
  }
  
  return 'unknown';
}

/**
 * アセットオブジェクトからメディアタイプを判定
 */
export function getMediaTypeFromAsset(asset: any): MediaType {
  // 最初にMIMEタイプで判定
  if (asset.mime) {
    const typeFromMime = getMediaTypeFromMime(asset.mime);
    if (typeFromMime !== 'unknown') {
      return typeFromMime;
    }
  }
  
  // MIMEタイプが不明な場合はファイル名で判定
  if (asset.name || asset.url) {
    const filename = asset.name || asset.url;
    return getMediaTypeFromExtension(filename);
  }
  
  return 'unknown';
}

/**
 * アセット配列をメディアタイプ別にフィルタリング
 */
export function filterAssetsByMediaType(assets: any[], mediaType: MediaType): any[] {
  return assets.filter(asset => getMediaTypeFromAsset(asset) === mediaType);
}

/**
 * 画像かどうかを判定
 */
export function isImageAsset(asset: any): boolean {
  return getMediaTypeFromAsset(asset) === 'image';
}

/**
 * 動画かどうかを判定
 */
export function isVideoAsset(asset: any): boolean {
  return getMediaTypeFromAsset(asset) === 'video';
}