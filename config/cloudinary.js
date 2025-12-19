const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================

// Validate environment variables
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ ERROR: Cloudinary credentials are missing in .env file!');
  console.error('Please add:');
  console.error('CLOUDINARY_CLOUD_NAME=your-cloud-name');
  console.error('CLOUDINARY_API_KEY=your-api-key');
  console.error('CLOUDINARY_API_SECRET=your-api-secret');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME);

// ============================================
// STORAGE FOR IMAGES (Posts, Avatars, Cover Photos)
// ============================================

const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nelly-korda/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 1080, height: 1080, crop: 'limit', quality: 'auto' },
    ],
  },
});

// ============================================
// STORAGE FOR VIDEOS (Stories, Posts)
// ============================================

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nelly-korda/videos',
    resource_type: 'auto',
    allowed_formats: ['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 720, height: 1280, crop: 'limit', quality: 'auto' },
    ],
  },
});

// ============================================
// STORAGE FOR STORY MEDIA
// ============================================

const storyStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video');
    
    return {
      folder: 'nelly-korda/stories',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'mov', 'avi', 'webm']
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: isVideo
        ? [
            { width: 720, height: 1280, crop: 'fill', quality: 'auto' },
            { duration: 30 },
          ]
        : [
            { width: 720, height: 1280, crop: 'fill', quality: 'auto' },
          ],
    };
  },
});

// ============================================
// STORAGE FOR AUDIO FILES
// ============================================

const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nelly-korda/audio',
    resource_type: 'video',
    allowed_formats: ['webm', 'wav', 'mp3', 'mpeg', 'ogg', 'mp4', 'm4a'],
    format: 'mp3',
    transformation: [
      {
        audio_codec: 'mp3',
        audio_frequency: 44100,
        bit_rate: '128k'
      }
    ],
    //Ensure clean MP3 URL
    public_id: (req, file) => `voice_${Date.now()}`
  },
});

// ============================================
// MULTER FILE UPLOAD MIDDLEWARE
// ============================================

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const uploadVideo = multer({
  storage: storyStorage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/'];
    const isAllowed = allowedTypes.some((type) => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

const uploadMultipleImages = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// ============================================
// UPLOAD MEDIA WITH AUDIO SUPPORT
// ============================================

const uploadMediaWithAudio = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const isVideo = file.mimetype.startsWith('video');
      const isAudio = file.mimetype.startsWith('audio');
      
      console.log('📎 Processing file upload:', {
        name: file.originalname,
        type: file.mimetype,
        size: file.size
      });
      
      if (isAudio) {
        //Proper audio configuration for web playback
        return {
          folder: 'nelly-korda/audio',
          resource_type: 'video',
          allowed_formats: ['webm', 'ogg', 'mp3', 'wav', 'mpeg', 'mp4', 'm4a'],
          format: 'mp3',
          flags: 'attachment',
          transformation: [
            {
              audio_codec: 'mp3',
              audio_frequency: 44100,
              bit_rate: '128k',
              fetch_format: 'mp3'
            }
          ]
        };
      }
      
      if (isVideo) {
        return {
          folder: 'nelly-korda/videos',
          resource_type: 'video',
          allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
          transformation: [
            { width: 1920, height: 1080, crop: 'limit', quality: 'auto' }
          ],
        };
      }
      
      // Images
      return {
        folder: 'nelly-korda/images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        transformation: [
          { width: 1920, height: 1080, crop: 'limit', quality: 'auto' }
        ],
      };
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 Checking file type:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    // Allow images, audio, AND video files
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Audio - COMPLETE LIST
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg',
      'audio/ogg;codecs=opus',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/x-m4a',
      // Video
      'video/mp4',
      'video/mov',
      'video/avi',
      'video/webm'
    ];
    
    // Check if MIME type is allowed (including partial matches for codecs)
    const isAllowed = allowedMimeTypes.some(allowedType => 
      file.mimetype.includes(allowedType) || allowedType.includes(file.mimetype)
    );
    
    if (isAllowed) {
      console.log('File type allowed:', file.mimetype);
      cb(null, true);
    } else {
      console.error('❌ File type rejected:', file.mimetype);
      const error = new Error(`File type not allowed: ${file.mimetype}. Only images, audio, and video files are accepted.`);
      cb(error, false);
    }
  },
});

// ============================================
// DELETE FILE FROM CLOUDINARY
// ============================================

const deleteFile = async (publicId) => {
  try {
    // Determine resource type from public ID or path
    let resourceType = 'image';
    if (publicId.includes('video') || publicId.includes('audio')) {
      resourceType = 'video';
    }
    
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    
    console.log('Deleted from Cloudinary:', publicId);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary Delete Error:', error.message);
    throw error;
  }
};

// ============================================
// DELETE MULTIPLE FILES
// ============================================

const deleteMultipleFiles = async (publicIds) => {
  try {
    const deletePromises = publicIds.map((publicId) => deleteFile(publicId));
    await Promise.all(deletePromises);
    return { success: true };
  } catch (error) {
    console.error('❌ Cloudinary Bulk Delete Error:', error.message);
    throw error;
  }
};

// ============================================
// STORAGE FOR POST MEDIA (Images + Videos)
// ============================================

const postMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video');
    
    return {
      folder: 'nelly-korda/posts',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'mov', 'avi', 'webm']
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: isVideo
        ? [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }]
        : [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
    };
  },
});

const uploadMedia = multer({
  storage: postMediaStorage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/', 'video/'];
    const isAllowed = allowedTypes.some((type) => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  uploadMultipleImages,
  uploadMedia,
  uploadMediaWithAudio,
  deleteFile,
  deleteMultipleFiles,
};