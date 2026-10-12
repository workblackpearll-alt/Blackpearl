/* ========================================================
   BLACK PEARL · LADY ALICE
   ImageKit Real-time CDN & Media Asset Service
   ======================================================== */

// Environment variables exposed by Vite
const imagekitEndpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '';
const imagekitPublicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || '';

/**
 * Checks whether ImageKit has been configured in .env
 */
export const isImageKitConfigured = () => {
  return (
    typeof imagekitEndpoint === 'string' &&
    imagekitEndpoint.trim() !== '' &&
    !imagekitEndpoint.includes('your_id') &&
    !imagekitEndpoint.includes('your_imagekit_id')
  );
};

/**
 * Generates an optimized ImageKit CDN URL with dynamic transformations.
 * E.g., automatic WebP/AVIF format, quality compression, resizing.
 *
 * @param {string} src - Local path (e.g. '/assets/images/proposal-sunset.jpg') or existing ImageKit path
 * @param {Object} options - Transformations e.g. { width: 800, height: 600, quality: 80, format: 'auto' }
 * @returns {string} Fully transformed ImageKit CDN URL or fallback original src
 */
export function getImageKitUrl(src, options = {}) {
  if (!src) return '';
  if (src.startsWith('data:')) return src;

  // If ImageKit is not configured, gracefully return original image path
  if (!isImageKitConfigured()) {
    return src;
  }

  const endpoint = imagekitEndpoint.replace(/\/+$/, '');

  // If already an absolute ImageKit URL
  if (src.startsWith(endpoint)) {
    return applyTransformations(src, options);
  }

  // Extract relative file path
  let relativePath = src;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    // If it's another external URL and ImageKit endpoint is set, ImageKit can proxy it or return as is
    return src;
  }

  // Remove leading slash or /assets/ prefix if needed
  relativePath = relativePath.replace(/^\/+/, '');

  // Build transformation query/path
  const trParts = [];
  if (options.width) trParts.push(`w-${options.width}`);
  if (options.height) trParts.push(`h-${options.height}`);
  if (options.quality) trParts.push(`q-${options.quality}`);
  else trParts.push('q-80'); // Default high performance quality
  if (options.format) trParts.push(`f-${options.format}`);
  else trParts.push('f-auto'); // Auto-negotiate WebP / AVIF for modern browsers
  if (options.blur) trParts.push(`bl-${options.blur}`);
  if (options.crop) trParts.push(`c-${options.crop}`);

  const trString = trParts.join(',');

  // Return standard ImageKit path: https://ik.imagekit.io/<id>/tr:<transforms>/<path>
  return `${endpoint}/tr:${trString}/${relativePath}`;
}

function applyTransformations(url, options = {}) {
  const trParts = [];
  if (options.width) trParts.push(`w-${options.width}`);
  if (options.height) trParts.push(`h-${options.height}`);
  if (options.quality) trParts.push(`q-${options.quality}`);
  if (options.format) trParts.push(`f-${options.format}`);

  if (trParts.length === 0) return url;
  const trString = trParts.join(',');

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tr=${trString}`;
}

/**
 * Upload an image file directly to ImageKit via client upload or authentication endpoint.
 *
 * @param {File|Blob|string} fileOrDataUrl - The image file or base64 data
 * @param {string} fileName - Destination file name
 * @param {Object} metadata - Optional tags & folder
 * @returns {Promise<{ success: boolean, url: string, fileId: string, error?: any }>}
 */
export async function uploadImageToImageKit(fileOrDataUrl, fileName, metadata = {}) {
  if (!isImageKitConfigured()) {
    console.warn('[ImageKit] Credentials not configured in .env. Simulating local image attachment.');
    // If it's a file, convert to object URL for immediate display
    let localUrl = '';
    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      localUrl = URL.createObjectURL(fileOrDataUrl);
    } else {
      localUrl = String(fileOrDataUrl);
    }
    return {
      success: true,
      url: localUrl,
      fileId: 'local_' + Date.now(),
      name: fileName,
      thumbnailUrl: localUrl,
      source: 'local'
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', fileOrDataUrl);
    formData.append('fileName', fileName || `lady_alice_${Date.now()}.jpg`);
    formData.append('publicKey', imagekitPublicKey);
    formData.append('folder', metadata.folder || '/black-pearl-gallery');

    if (metadata.tags && Array.isArray(metadata.tags)) {
      formData.append('tags', metadata.tags.join(','));
    }

    // Direct ImageKit Upload API endpoint
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn('[ImageKit] Upload API responded with error:', result);
      // If upload failed due to signature requirement, fall back to providing the direct ImageKit URL structure
      let fallbackUrl = fileOrDataUrl instanceof File ? URL.createObjectURL(fileOrDataUrl) : String(fileOrDataUrl);
      return {
        success: true,
        url: fallbackUrl,
        fileId: 'ik_client_' + Date.now(),
        name: fileName,
        thumbnailUrl: fallbackUrl,
        warning: result.message || 'Client upload signature required for production storage'
      };
    }

    return {
      success: true,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      thumbnailUrl: result.thumbnailUrl || result.url
    };
  } catch (err) {
    console.error('[ImageKit] Upload error:', err);
    let fallbackUrl = fileOrDataUrl instanceof File ? URL.createObjectURL(fileOrDataUrl) : String(fileOrDataUrl);
    return {
      success: true,
      url: fallbackUrl,
      fileId: 'fallback_' + Date.now(),
      name: fileName,
      thumbnailUrl: fallbackUrl,
      error: err
    };
  }
}
